"""Apply fresh migration and load exports. Explicit new-project allowlist prevents archive writes."""
import pathlib,json,urllib.request,sys
values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l)
ref=values['RELAUNCH_PROJECT_REF']
assert ref=='rqcqlpoxtdddjcylhopk', 'Only the new relaunch project may be written'
def management(path,data=None):
 req=urllib.request.Request('https://api.supabase.com/v1/'+path,headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},data=json.dumps(data).encode() if data is not None else None)
 with urllib.request.urlopen(req,timeout=180) as res:return json.load(res)
if '--migrate' in sys.argv:
 management(f'projects/{ref}/database/query',{'query':pathlib.Path('supabase/migrations/20261113000000_relaunch.sql').read_text()})
keys=management(f'projects/{ref}/api-keys');keys={k['name']:k['api_key'] for k in keys}
url=f'https://{ref}.supabase.co'
p=pathlib.Path('.env.local');p.write_text(f'NEXT_PUBLIC_SUPABASE_URL={url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY={keys["anon"]}\nSUPABASE_SERVICE_ROLE_KEY={keys["service_role"]}\nNEXT_PUBLIC_SITE_URL=https://www.indiefindr.gg\n');p.chmod(0o600)
for table in ['tags','games','game_recs']:
 rows=[json.loads(l) for l in pathlib.Path('data/relaunch',table+'.jsonl').open()]
 for i in range(0,len(rows),500):
  req=urllib.request.Request(f'{url}/rest/v1/{table}',data=json.dumps(rows[i:i+500]).encode(),headers={'apikey':keys['service_role'],'Authorization':'Bearer '+keys['service_role'],'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},method='POST')
  try:
   with urllib.request.urlopen(req,timeout=90) as res:res.read()
  except urllib.error.HTTPError as e:
   print(e.read().decode()[:1000]);raise SystemExit(1)
 print(table,len(rows),flush=True)
