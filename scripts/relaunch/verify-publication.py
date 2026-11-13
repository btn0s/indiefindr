"""Save final database counts and the size of the public uploaded search index."""
import gzip
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
v = dict(line.split('=', 1) for line in (ROOT / '.env.relaunch-admin').read_text().splitlines() if '=' in line)
ref = v['RELAUNCH_PROJECT_REF']
assert ref == 'rqcqlpoxtdddjcylhopk'
sql = """select
 (select count(*) from public.games) as games,
 (select count(*) from public.games where is_indie) as indie_games,
 (select count(*) from public.game_recs) as rec_rows,
 (select count(*) from public.game_recs where source='model') as model_rows,
 (select count(*) from public.game_recs where source='llm') as llm_rows,
 (select count(distinct appid) from public.game_recs where source='llm') as llm_slates,
 (select count(*) from public.games where cardinality(screenshots)>0 or jsonb_array_length(trailers)>0) as games_with_media,
 (select count(*) from public.games g where (select count(*) from public.game_recs r where r.appid=g.appid and source='model')<>10) as invalid_model_slates,
 (select count(*) from public.game_recs r join public.games g on g.appid=r.rec_appid where not g.is_indie) as non_indie_targets
"""
request = urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',
    headers={'Authorization': 'Bearer ' + v['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json'},
    data=json.dumps({'query': sql}).encode())
with urllib.request.urlopen(request, timeout=180) as response:
    report = json.load(response)[0]
search=json.loads((ROOT/'data/search-publication.json').read_text())
with urllib.request.urlopen(search['url']+'?v='+search['sha256'], timeout=120) as response:
    body = response.read()
assert hashlib.sha256(body).hexdigest()==search['sha256'],'Uploaded search content does not match publication'
report.update(index_games=len(json.loads(body)['games']), index_bytes=len(body), index_gzip_bytes=len(gzip.compress(body)))
prices=json.loads((ROOT/'data/steam-full/us-prices.json').read_text())
request.data=json.dumps({'query':'select appid,price_cents from public.games where appid in (2868840,3321460,2878710,382110,2864560,774181)'}).encode()
with urllib.request.urlopen(request,timeout=180) as response:
    samples=json.load(response)
assert len(samples)==6,samples
for sample in samples:
    assert sample['price_cents']==(prices[str(sample['appid'])] or {}).get('final'),sample
report['verified_us_price_examples']=samples
assert report['invalid_model_slates'] == report['non_indie_targets'] == 0, report
(ROOT / 'data/publication-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
