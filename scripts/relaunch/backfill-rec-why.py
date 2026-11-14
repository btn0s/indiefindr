"""One-off: fill game_recs.why for slates published before it existed. Nightly publication writes it from then on.

Same rule as prepare.py (rec_why.py), from the published games' tags. --dry-run reports counts and examples only.
"""
import argparse,collections,json,pathlib,ssl,time,urllib.error,urllib.request
from rec_why import tag_specificity,why
p=argparse.ArgumentParser();p.add_argument('--dry-run',action='store_true');p.add_argument('--after',type=int,default=0,help='resume after this source appid');a=p.parse_args()
values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=values['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
def query(sql):
 req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'indiefindr-pipeline'},data=json.dumps({'query':sql}).encode())
 for attempt in range(6):
  try:
   with urllib.request.urlopen(req,timeout=300) as r:return json.load(r)
  except urllib.error.HTTPError as error:
   if error.code!=429 and error.code<500 or attempt==5:raise
  except (urllib.error.URLError,ssl.SSLError,TimeoutError,ConnectionError):
   if attempt==5:raise
  time.sleep(2**attempt)
games=[];last=0
while page:=query(f'select appid,is_indie,tag_ids from public.games where appid>{last} order by appid limit 50000'):games+=page;last=page[-1]['appid']
tags={int(t['id']):t['name'] for t in query('select id,name from public.tags')};byid={g['appid']:g for g in games}
specificity=tag_specificity(games,tags);stats=collections.Counter();last=a.after
while recs:=query(f'select appid,source,rank,rec_appid from public.game_recs where appid in (select distinct appid from public.game_recs where appid>{last} order by appid limit 400) order by appid'):
 last=recs[-1]['appid'];rows=[dict(appid=r['appid'],source=r['source'],rank=r['rank'],why=why(byid[r['appid']]['tag_ids'],byid[r['rec_appid']]['tag_ids'],specificity,tags)) for r in recs]
 stats.update(len(r['why'] or []) for r in rows)
 if a.dry_run:
  if stats.total()<=len(rows):print([(byid[r['appid']]['appid'],r['rank'],r['why']) for r in rows[:5]])
 else:query("update public.game_recs g set why=r.why from jsonb_to_recordset('"+json.dumps(rows).replace("'","''")+"'::jsonb) as r(appid integer,source text,rank integer,why text[]) where g.appid=r.appid and g.source=r.source and g.rank=r.rank")
 print('recs',stats.total(),'through appid',last,'by shared tags',dict(sorted(stats.items())),flush=True)
