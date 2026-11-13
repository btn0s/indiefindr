"""Capacity-checked atomic model replacement; verify archived LLM rows unchanged."""
import fcntl
import argparse,collections,itertools,json,pathlib,urllib.request,urllib.error,ssl,time
from capacity import check_capacity,assert_physical_headroom
from selection import MODEL_VERSION,SLATE_SIZE,POPULARITY_CAPS
p=argparse.ArgumentParser();p.add_argument('--slates',type=pathlib.Path,required=True);a=p.parse_args()
lock=pathlib.Path('data/ingest.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
v=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=v['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
def api(path,data=None):
 req=urllib.request.Request('https://api.supabase.com/v1/'+path,headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},data=json.dumps(data).encode() if data else None)
 for attempt in range(5):
  try:
   with urllib.request.urlopen(req,timeout=180) as r:return json.load(r)
  except urllib.error.HTTPError as error:
   if error.code!=429 and error.code<500:
    print(error.read().decode()[:1000],flush=True);raise
   if attempt==4:raise
  except (urllib.error.URLError,ssl.SSLError,TimeoutError,ConnectionError):
   if attempt==4:raise
  time.sleep(min(30,2**attempt))
def query(sql):return api(f'projects/{ref}/database/query',{'query':sql,'read_only':False})
def llm():return query("select count(*) as rows,md5(string_agg(row(appid,rank,rec_appid,model_version)::text,',' order by appid,rank,rec_appid)) as checksum from public.game_recs where source='llm'")[0]
games=query('select appid,is_indie,review_count from public.games');byid={g['appid']:g for g in games}
ids=set();hist=collections.Counter();total=0
for line in a.slates.open():
 s=json.loads(line);appid=s['source_appid'];targets=s['suggestions'];assert appid not in ids;ids.add(appid)
 assert s['model']==MODEL_VERSION and len(targets)<=SLATE_SIZE
 assert [r['rank'] for r in targets]==list(range(1,len(targets)+1))
 assert len({r['suggested_appid'] for r in targets})==len(targets) and all(r['suggested_appid']!=appid for r in targets)
 assert all(byid[r['suggested_appid']]['is_indie'] for r in targets)
 assert all(sum(byid[r['suggested_appid']]['review_count']>=threshold for r in targets)<=cap for threshold,cap in POPULARITY_CAPS)
 hist[len(targets)]+=1;total+=len(targets)
assert ids==set(byid)
before=llm();capacity=check_capacity(api,len(ids),total+int(before['rows']));print(capacity,flush=True);assert capacity['publication_allowed'],'Operating budget exceeded; no writes made'
query(f'alter table public.game_recs drop constraint game_recs_rank_check, add constraint game_recs_rank_check check(rank between 1 and {SLATE_SIZE})')
existing={r['appid']:(r['version'],tuple(r['targets'])) for r in query("select appid,min(model_version) version,array_agg(rec_appid order by rank) targets from public.game_recs where source='model' group by appid")}
with a.slates.open() as f:
 replaced=0
 while batch:=list(itertools.islice(f,100)):
  slates=[json.loads(l) for l in batch]
  changed=[s for s in slates if existing.get(s['source_appid'])!=(MODEL_VERSION,tuple(r['suggested_appid'] for r in s['suggestions']))]
  if not changed:
   replaced+=len(slates);continue
  assert_physical_headroom(api,capacity['operating_budget_bytes'])
  records=[dict(appid=s['source_appid'],rank=r['rank'],rec_appid=r['suggested_appid'],source='model',model_version=MODEL_VERSION) for s in changed for r in s['suggestions']]
  data=json.dumps(records).replace("'","''");batchids=','.join(str(s['source_appid']) for s in changed)
  query("begin; delete from public.game_recs where source='model' and appid in ("+batchids+"); insert into public.game_recs(appid,rank,rec_appid,source,model_version) select appid,rank,rec_appid,source,model_version from jsonb_to_recordset('"+data+"'::jsonb) as r(appid integer,rank integer,rec_appid integer,source text,model_version text); commit;")
  replaced+=len(slates)
  if replaced%5000==0:print('replaced',replaced,flush=True)
query('vacuum (analyze) public.game_recs')
after=llm();assert before==after,(before,after)
actual=query("select n,count(*) as games from (select g.appid,count(r.appid) n from games g left join game_recs r on r.appid=g.appid and r.source='model' group by g.appid) s group by n")
assert {int(r['n']):int(r['games']) for r in actual}==dict(hist),actual
caps=' or '.join(f'count(*) filter(where g.review_count>={threshold})>{cap}' for threshold,cap in POPULARITY_CAPS)
checks=query("select (select count(*) from game_recs r join games g on g.appid=r.rec_appid where r.source='model' and not g.is_indie) non_indie_targets,(select count(*) from (select r.appid from game_recs r join games g on g.appid=r.rec_appid where r.source='model' group by r.appid having "+caps+") s) cap_violations")
assert all(int(x)==0 for x in checks[0].values()),checks
report={'games':len(ids),'model_rows':total,'llm_rows':int(after['rows']),'total_rows':total+int(after['rows']),'slate_histogram':dict(hist),'short_slates':sum(n for size,n in hist.items() if size<SLATE_SIZE),'llm_preserved':before==after,'checks':checks,'capacity':capacity}
pathlib.Path('data/slates-24-publication.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
