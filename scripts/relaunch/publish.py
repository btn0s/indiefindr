"""Publish a complete offline catalog to the relaunch database only.

The compact games/tags are loaded first. Recommendation batches are replaced in
transactions so a page's stored slate is never partially updated. LLM lists are
preserved from their frozen export. Checks run before and after publication.
"""
import argparse,json,pathlib,urllib.request
from capacity import check_capacity
p=argparse.ArgumentParser();p.add_argument('--data',type=pathlib.Path,default=pathlib.Path('data/full-import'));p.add_argument('--check-budget-only',action='store_true');a=p.parse_args()
values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=values['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
def management(path,data=None):
 req=urllib.request.Request('https://api.supabase.com/v1/'+path,headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},data=json.dumps(data).encode() if data is not None else None)
 with urllib.request.urlopen(req,timeout=180) as r:return json.load(r)
def query(sql):return management(f'projects/{ref}/database/query',{'query':sql})
def read(table):return [json.loads(l) for l in (a.data/(table+'.jsonl')).open()]
games=read('games');recs=read('game_recs');tags=read('tags');byid={g['appid']:g for g in games};slates={}
for r in recs:
 assert r['appid'] in byid and byid[r['rec_appid']]['is_indie'] and r['appid']!=r['rec_appid']
 slates.setdefault((r['appid'],r['source']),[]).append(r)
for g in games:
 slate=slates.get((g['appid'],'model'),[])
 assert len(slate)==10 and sorted(r['rank'] for r in slate)==list(range(1,11)) and len({r['rec_appid'] for r in slate})==10
# Check the actual plan entitlement with 10% operating headroom.
capacity=check_capacity(management,len(games),len(recs));print(capacity,flush=True)
assert capacity['publication_allowed'],'Expanded catalog publication needs capacity approval; no writes or plan changes made.'
if a.check_budget_only:raise SystemExit
keys={k['name']:k['api_key'] for k in management(f'projects/{ref}/api-keys')};key=keys['service_role']
for table,rows in [('tags',tags),('games',games)]:
 for start in range(0,len(rows),500):
  req=urllib.request.Request(f'https://{ref}.supabase.co/rest/v1/{table}',headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},data=json.dumps(rows[start:start+500]).encode())
  try:
   with urllib.request.urlopen(req,timeout=180) as r:r.read()
  except urllib.error.HTTPError as e:
   print(e.read().decode()[:1000]);raise SystemExit(1)
 print('loaded',table,len(rows),flush=True)
ids=sorted(byid)
for start in range(0,len(ids),250):
 batch=ids[start:start+250];records=[r for appid in batch for source in ['model','llm'] for r in slates.get((appid,source),[])]
 data=json.dumps(records).replace("'","''")
 query("begin; delete from public.game_recs where (source='model' or source='llm' and appid in (select appid from jsonb_to_recordset('"+data+"'::jsonb) as r(appid integer,source text) where source='llm')) and appid in ("+','.join(map(str,batch))+"); insert into public.game_recs(appid,rank,rec_appid,source,model_version) select appid,rank,rec_appid,source,model_version from jsonb_to_recordset('"+data+"'::jsonb) as r(appid integer,rank integer,rec_appid integer,source text,model_version text); commit;")
 if start%5000==0:print('published',min(start+250,len(ids)),flush=True)
checks=query("select (select count(*) from games g where (select count(*) from game_recs r where r.appid=g.appid and r.source='model')<>10) as empty_model_pages,(select count(*) from game_recs r join games g on g.appid=r.rec_appid where not g.is_indie) as non_indie_targets")
assert all(int(v)==0 for v in checks[0].values()),checks
print('Publication verified',checks,flush=True)
