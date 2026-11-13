"""Save final database counts, canonical prices, and uploaded search index size."""
import gzip,hashlib,json,pathlib,urllib.request
from selection import SLATE_SIZE
ROOT=pathlib.Path(__file__).resolve().parents[2]
v=dict(line.split('=',1) for line in (ROOT/'.env.relaunch-admin').read_text().splitlines() if '=' in line)
ref=v['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
def query(sql):
 request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},data=json.dumps({'query':sql}).encode())
 with urllib.request.urlopen(request,timeout=180) as response:return json.load(response)
# Aggregate each table once, without repeated correlated counts per source.
report=query("select count(*) as games,count(*) filter(where is_indie) as indie_games,count(*) filter(where cardinality(screenshots)>0 or jsonb_array_length(trailers)>0) as games_with_media from public.games")[0]
recs=query(f"with slates as (select appid,count(*) as rows,count(*) filter(where source='model') as model_rows,count(*) filter(where source='llm') as llm_rows from public.game_recs group by appid) select sum(rows) as rec_rows,sum(model_rows) as model_rows,sum(llm_rows) as llm_rows,count(*) filter(where llm_rows>0) as llm_slates,count(*) filter(where model_rows={SLATE_SIZE}) as valid_model_slates from slates")[0]
report.update(recs);report['invalid_model_slates']=report['games']-report.pop('valid_model_slates')
report.update(query("select count(*) as non_indie_targets from public.game_recs r join public.games g on g.appid=r.rec_appid where not g.is_indie")[0])
report.update(query("select count(*) as low_score_targets from public.game_recs r join public.games g on r.rec_appid=g.appid where g.review_count>=10 and coalesce(g.clean_score,g.review_positive_pct)<70")[0])
assert report['low_score_targets']==0,report
search=json.loads((ROOT/'data/search-publication.json').read_text())
with urllib.request.urlopen(search['url']+'?v='+search['sha256'],timeout=120) as response:body=response.read()
assert hashlib.sha256(body).hexdigest()==search['sha256'],'Uploaded search content does not match publication'
report.update(index_games=len(json.loads(body)['games']),index_bytes=len(body),index_gzip_bytes=len(gzip.compress(body)))
prices=json.loads((ROOT/'data/steam-full/us-prices.json').read_text())
samples=query('select appid,price_cents from public.games where appid in (2868840,3321460,2878710,382110,2864560,774181)')
assert len(samples)==6,samples
for sample in samples:assert sample['price_cents']==(prices[str(sample['appid'])] or {}).get('final'),sample
report['verified_us_price_examples']=samples
report['short_model_slates']=report.pop('invalid_model_slates')
assert report['non_indie_targets']==0,report
(ROOT/'data/publication-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
