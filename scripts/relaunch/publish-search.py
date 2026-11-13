"""Publish a compact public title index for browser-worker search."""
import argparse,gzip,json,pathlib,urllib.request,urllib.error
p=argparse.ArgumentParser();p.add_argument('--games',type=pathlib.Path,required=True);a=p.parse_args()
v=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=v['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
r=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/api-keys',headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN']})
with urllib.request.urlopen(r) as f:keys={x['name']:x['api_key'] for x in json.load(f)}
key=keys['service_role'];base=f'https://{ref}.supabase.co/storage/v1';headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'}
try:
 with urllib.request.urlopen(urllib.request.Request(base+'/bucket/search',headers=headers)) as r:r.read()
except urllib.error.HTTPError as error:
 if error.code!=404 and error.code!=400:raise
 req=urllib.request.Request(base+'/bucket',headers=headers,data=json.dumps({'id':'search','name':'search','public':True}).encode())
 with urllib.request.urlopen(req) as r:r.read()
rows=[json.loads(l) for l in a.games.open()];rows.sort(key=lambda g:(-g['review_count'],g['appid']))
body=json.dumps({'games':[[g['appid'],g['title']] for g in rows]},ensure_ascii=False,separators=(',',':')).encode()
if len(gzip.compress(body))>3_000_000:
 rows=[g for g in rows if g['review_count']>0]
 body=json.dumps({'games':[[g['appid'],g['title']] for g in rows]},ensure_ascii=False,separators=(',',':')).encode()
 print('Index exceeded 3 MB gzipped; trimmed to games with reviews',flush=True)
req=urllib.request.Request(base+'/object/search/titles.json',headers={**headers,'x-upsert':'true','cache-control':'max-age=3600'},data=body,method='POST')
with urllib.request.urlopen(req,timeout=120) as r:r.read()
print({'searchable_games':len(rows),'bytes':len(body),'gzip_bytes':len(gzip.compress(body)),'url':f'{base}/object/public/search/titles.json'})
