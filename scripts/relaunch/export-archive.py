"""Export retired tables through read-only transactions against the archive."""
import pathlib,json,urllib.request
values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l)
url='https://api.supabase.com/v1/projects/ndiwjugonecjegtsdjhv/database/query'
def query(sql):
 req=urllib.request.Request(url,data=json.dumps({'query':'begin read only; '+sql+'; commit;'}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=120) as r:return json.load(r)
out=pathlib.Path('data/archive');out.mkdir(exist_ok=True)
tables=query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
for item in tables:
 table=item['table_name']
 if not any(x in table for x in ['collection','judgment','bpr','train','pair','model']):continue
 assert table.replace('_','').isalnum()
 rows=query('select * from public."'+table+'"');(out/(table+'.json')).write_text(json.dumps(rows));print(table,len(rows),flush=True)
