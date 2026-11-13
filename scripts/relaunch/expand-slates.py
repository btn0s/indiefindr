"""Select longer slates from saved ordered candidates; no encoding or inference."""
import argparse,json,pathlib
from catalog import is_indie
from selection import SLATE_SIZE,CANDIDATE_LIMIT,MODEL_VERSION,select_targets
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
rows=json.loads((a.source/'data/catalog.json').read_text())['rows'];tags=json.loads((a.source/'data/steam_tags.json').read_text())
allowed={r['appid'] for r in rows if is_indie(r,tags[str(r['appid'])]['tags'])};reviews={r['appid']:tags[str(r['appid'])]['popularity'].get('review_count') or 0 for r in rows}
short=[];seen=set();total=0;tmp=a.out.with_suffix('.tmp')
with tmp.open('w') as out,(a.source/'slates_indie.jsonl').open() as saved:
 for line in saved:
  slate=json.loads(line);appid=slate['source_appid'];assert appid not in seen;seen.add(appid)
  candidates=[i for i in slate['ranked_candidates'][:CANDIDATE_LIMIT] if i in allowed and i!=appid]
  selected=select_targets(candidates,reviews)
  if len(selected)<SLATE_SIZE:short.append({'appid':appid,'targets':len(selected)})
  total+=len(selected)
  out.write(json.dumps({'source_appid':appid,'model':MODEL_VERSION,'suggestions':[{'rank':i,'suggested_appid':t} for i,t in enumerate(selected,1)]})+'\n')
assert seen=={r['appid'] for r in rows}
tmp.replace(a.out);print(json.dumps({'games':len(seen),'model_rows':total,'short_slates':len(short),'short_details':short}),flush=True)
