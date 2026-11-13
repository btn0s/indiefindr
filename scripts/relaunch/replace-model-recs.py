"""Replace model slates atomically per batch; preserve all LLM rows."""
import json,pathlib,urllib.request
values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l)
ref=values['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
slates=[json.loads(l) for l in pathlib.Path('data/relaunch-source/slates_indie.jsonl').open()]
assert len(slates)==25555 and all(len(s['suggestions'])==10 for s in slates)
def query(sql):
 req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=180) as r:return json.load(r)
for start in range(0,len(slates),500):
 batch=slates[start:start+500];ids=','.join(str(int(s['source_appid'])) for s in batch)
 records=','.join(f"({int(s['source_appid'])},{int(r['rank'])},{int(r['suggested_appid'])},'model','lambdarank_merged-indie-20261113')" for s in batch for r in s['suggestions'])
 query(f"begin; delete from public.game_recs where source='model' and appid in ({ids}); insert into public.game_recs(appid,rank,rec_appid,source,model_version) values {records}; commit;")
 if start%5000==0:print('replaced',min(start+500,len(slates)),flush=True)
print(query("select source,count(*) as rows,count(distinct appid) as sources from public.game_recs group by source"))
checks=query("select (select count(*) from games g where not exists(select 1 from game_recs r where r.appid=g.appid and r.source='model')) as empty_model_pages,(select count(*) from game_recs r join games g on g.appid=r.rec_appid where not g.is_indie) as non_indie_targets")
assert all(int(v)==0 for v in checks[0].values()),checks
print(checks)
