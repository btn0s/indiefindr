"""Select indie slates from the merged model's already-scored top-200.

Filtering a score-ordered list before truncation preserves the saved LambdaRank
ordering exactly. No retraining, alternate ranker, or request-time inference.
"""
import argparse, json, pathlib, hashlib
import numpy as np
from selection import MODEL_VERSION, SLATE_SIZE, select_targets
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,default=pathlib.Path('data/relaunch-source'));p.add_argument('--games',type=pathlib.Path,default=pathlib.Path('data/relaunch/games.jsonl'));a=p.parse_args()
rows=sorted(json.loads((a.source/'data/catalog.json').read_text())['rows'],key=lambda r:int(r['appid']))
games={g['appid']:g for g in map(json.loads,a.games.open())}
reviews={appid:g['review_count'] for appid,g in games.items()}
ranked=np.load(a.source/'lambdarank_merged_top200.npy');assert ranked.shape==(len(rows),200)
slates=[];short=[]
for i,row in enumerate(rows):
 targets=[]
 for j in ranked[i]:
  target=rows[int(j)]['appid']
  if target!=row['appid'] and target not in targets and games[target]['is_indie']:targets.append(target)
 targets=select_targets(targets,reviews)
 if len(targets)<SLATE_SIZE:short.append({'appid':row['appid'],'targets':len(targets)})
 slates.append({'source_appid':row['appid'],'model':MODEL_VERSION,'suggestions':[{'rank':rank,'suggested_appid':target} for rank,target in enumerate(targets,1)]})
out=a.source/'slates_indie.jsonl'
with out.open('w') as f:
 for slate in slates:f.write(json.dumps(slate)+'\n')
print({'sources':len(slates),'recommendations':sum(len(s['suggestions']) for s in slates),'short_slates':short,'ranked_candidates_sha256':hashlib.sha256((a.source/'lambdarank_merged_top200.npy').read_bytes()).hexdigest()})
