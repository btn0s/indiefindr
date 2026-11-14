"""Publish a complete offline catalog to the relaunch database only.

The compact games/tags are loaded first. Recommendation batches are replaced in
transactions so a page's stored slate is never partially updated. LLM lists are
preserved from their frozen export. Checks run before and after publication.
"""
import argparse,json,pathlib,urllib.request
from review_quality import eligible
from model_assertions import verify_model_slates
from capacity import check_capacity,assert_physical_headroom
from selection import POPULARITY_CAPS, MODEL_VERSION, SLATE_SIZE
p=argparse.ArgumentParser();p.add_argument('--data',type=pathlib.Path,default=pathlib.Path('data/full-import'));p.add_argument('--check-budget-only',action='store_true');a=p.parse_args()
values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=values['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
def management(path,data=None):
 req=urllib.request.Request('https://api.supabase.com/v1/'+path,headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},data=json.dumps(data).encode() if data is not None else None)
 with urllib.request.urlopen(req,timeout=180) as r:return json.load(r)
def query(sql):return management(f'projects/{ref}/database/query',{'query':sql})
def read(table):return [json.loads(l) for l in (a.data/(table+'.jsonl')).open()]
games=read('games');recs=read('game_recs');tags=read('tags');byid={g['appid']:g for g in games};slates={}
for r in recs:
 assert r['appid'] in byid and byid[r['rec_appid']]['is_indie'] and eligible(byid[r['rec_appid']]) and r['appid']!=r['rec_appid']
 slates.setdefault((r['appid'],r['source']),[]).append(r)
for g in games:
 slate=slates.get((g['appid'],'model'),[])
 assert all(r['model_version']==MODEL_VERSION for r in slate)
 assert all(sum(byid[r['rec_appid']]['review_count']>=threshold for r in slate)<=cap for threshold,cap in POPULARITY_CAPS)
 assert len(slate)<=SLATE_SIZE and sorted(r['rank'] for r in slate)==list(range(1,len(slate)+1)) and len({r['rec_appid'] for r in slate})==len(slate)
# Check the actual plan entitlement with 10% operating headroom.
capacity=check_capacity(management,len(games),len(recs));print(capacity,flush=True)
assert capacity['publication_allowed'],'Expanded catalog publication needs capacity approval; no writes or plan changes made.'
if a.check_budget_only:raise SystemExit
query(f'alter table public.game_recs drop constraint game_recs_rank_check, add constraint game_recs_rank_check check(rank between 1 and {SLATE_SIZE})')
keys={k['name']:k['api_key'] for k in management(f'projects/{ref}/api-keys')};key=keys['service_role']
for table,rows in [('tags',tags),('games',games)]:
 for start in range(0,len(rows),500):
  req=urllib.request.Request(f'https://{ref}.supabase.co/rest/v1/{table}',headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},data=json.dumps(rows[start:start+500]).encode())
  try:
   with urllib.request.urlopen(req,timeout=180) as r:r.read()
  except urllib.error.HTTPError as e:
   print(e.read().decode()[:1000]);raise SystemExit(1)
 print('loaded',table,len(rows),flush=True)
# Keep eligible archived suggestions, but remove targets invalidated by ownership changes.
query("delete from public.game_recs r using public.games g where r.rec_appid=g.appid and r.source='llm' and (not g.is_indie or (g.review_count>=10 and coalesce(g.clean_score,g.review_positive_pct)<70))")
ids=sorted(byid)
for start in range(0,len(ids),100):
 assert_physical_headroom(management,capacity['operating_budget_bytes'])
 batch=ids[start:start+100];records=[r for appid in batch for source in ['model','llm'] for r in slates.get((appid,source),[])]
 data=json.dumps(records).replace("'","''")
 query("begin; delete from public.game_recs where (source='model' or source='llm' and appid in (select appid from jsonb_to_recordset('"+data+"'::jsonb) as r(appid integer,source text) where source='llm')) and appid in ("+','.join(map(str,batch))+"); insert into public.game_recs(appid,rank,rec_appid,source,model_version) select appid,rank,rec_appid,source,model_version from jsonb_to_recordset('"+data+"'::jsonb) as r(appid integer,rank integer,rec_appid integer,source text,model_version text); commit;")
 if start%5000==0:print('published',min(start+100,len(ids)),flush=True)
checks=verify_model_slates(query,{appid:len(slates.get((appid,'model'),[])) for appid in byid})
print('Publication verified',checks,flush=True)
