"""Production offline merged recommender. Frozen encoder and LambdaRank weights.

Encode and score in separate processes to avoid mixing Torch/LightGBM OpenMP.
The Fable scorer's global normalization is preserved over the eligible catalog.
Only indie targets enter the two retrieval lists and final stored top-ten.
"""
import os
os.environ.update(HF_HUB_OFFLINE='1',TOKENIZERS_PARALLELISM='false',OMP_NUM_THREADS='2',OPENBLAS_NUM_THREADS='2',MKL_NUM_THREADS='2',VECLIB_MAXIMUM_THREADS='2')
import argparse,hashlib,html,json,pathlib,re,sys,fcntl
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/relaunch'))
from catalog import is_indie
from selection import MODEL_VERSION, select_targets
p=argparse.ArgumentParser();p.add_argument('stage',choices=['encode','score']);p.add_argument('--source',type=pathlib.Path,default=ROOT/'data/full-source');p.add_argument('--artifacts',type=pathlib.Path,default=ROOT/'data/full-model');p.add_argument('--model',type=pathlib.Path,default=ROOT/'data/model');a=p.parse_args();a.artifacts.mkdir(parents=True,exist_ok=True)
# Serialize native model work even when invoked outside the nightly runner.
compute_lock=(ROOT/'data/recommender.lock').open('a')
fcntl.flock(compute_lock,fcntl.LOCK_EX)
rows=sorted(json.loads((a.source/'data/catalog.json').read_text())['rows'],key=lambda r:int(r['appid']))
enrichment=json.loads((a.source/'data/steam_tags.json').read_text());ids=[int(r['appid']) for r in rows]
# Frozen training recipe uses raw catalog text plus top-15 actual Steam tags.
def clean(text):return html.unescape(re.sub('<[^>]+>',' ',str(text or ''))).strip()
def text(row):
 tags=sorted(enrichment[str(row['appid'])]['tags'],key=lambda t:-t['weight'])[:15]
 genres=', '.join(g.get('description','') for g in (row.get('genres') or []))
 return f"{row['title']}. {clean(row.get('short_description'))} Genres: {genres}. Tags: {', '.join(t['name'] for t in tags)}. "+clean(row.get('long_description'))[:1600]
encoder_signature=hashlib.sha256((a.model/'encoder/model.safetensors').read_bytes()).hexdigest()
keys=[str(i)+':'+encoder_signature+':'+hashlib.sha256(text(r).encode()).hexdigest() for i,r in zip(ids,rows)]
if a.stage=='encode':
 import torch
 from sentence_transformers import SentenceTransformer
 assert torch.backends.mps.is_available(),'Offline encoding requires MPS; no CPU fallback'
 torch.set_num_threads(2);model=SentenceTransformer(str(a.model/'encoder'),device='mps',local_files_only=True);model.max_seq_length=256
 path=a.artifacts/'embeddings.npy';journal=a.artifacts/'embedding-keys.json'
 # Save by chunks to recover interrupted encoding without redoing completed rows.
 chunks=ROOT/'data/embedding-chunks';chunks.mkdir(exist_ok=True);output=np.lib.format.open_memmap(path,mode='w+',dtype=np.float32,shape=(len(rows),384))
 for start in range(0,len(rows),512):
  subset=keys[start:start+512];digest=hashlib.sha256('\n'.join(subset).encode()).hexdigest();chunk=chunks/(digest+'.npy')
  if not chunk.exists():
   values=model.encode([text(r) for r in rows[start:start+512]],batch_size=16,normalize_embeddings=True,show_progress_bar=False)
   np.save(chunk,values)
  output[start:start+len(subset)]=np.load(chunk);output.flush()
  if start%5120==0:print('encoded',min(start+512,len(rows)),'/',len(rows),flush=True)
 journal.write_text(json.dumps(keys));(a.artifacts/'ids.json').write_text(json.dumps(ids));print('Encoding complete',flush=True);raise SystemExit

from scipy.sparse import save_npz
from sklearn.feature_extraction import DictVectorizer
from sklearn.feature_extraction.text import TfidfTransformer
from lightgbm import Booster
import score as fable
params=json.loads((ROOT/'scripts/recommender/params.json').read_text());params['steam_tags']['file']=str((a.source/'data/steam_tags.json').resolve())
tokens=[(fable.tokens(r.get('title')),fable.tokens(r.get('short_description')),fable.tokens(r.get('long_description'))) for r in rows]
model=fable.Model(params=params,catalog=(rows,tokens));assert model.ids==ids
mask=model.ok & np.array([is_indie(r,enrichment[str(r['appid'])]['tags']) for r in rows]);assert mask.sum()>200
E=np.load(a.artifacts/'embeddings.npy',mmap_mode='r');assert json.loads((a.artifacts/'ids.json').read_text())==ids
assert json.loads((a.artifacts/'embedding-keys.json').read_text())==keys,'Encode the current dataset with the pinned encoder first'
v=DictVectorizer(dtype=np.float32);raw=v.fit_transform([{t['name'].casefold():float(t['weight']) for t in enrichment[str(r['appid'])]['tags'] if t['weight']>0} for r in rows]);linear=TfidfTransformer().fit_transform(raw).astype(np.float32).tocsr()
ranker=Booster(model_file=str(a.model/'ranker.txt'),params={'num_threads':2})
reviews=np.array([enrichment[str(i)]['popularity'].get('review_count') or 0 for i in ids],dtype=float);known=np.array([enrichment[str(i)]['popularity'].get('review_count') is not None for i in ids]);ratios=np.array([enrichment[str(i)]['popularity'].get('percent_positive')/100 if enrichment[str(i)]['popularity'].get('percent_positive') is not None else .5 for i in ids])
dev=[{str(x).casefold() for x in (r.get('developers') or [])} for r in rows];pub=[{str(x).casefold() for x in (r.get('publishers') or [])} for r in rows]
def year(r):
 match=re.search(r'(?:19|20)\d{2}',str(r.get('steam_release_date') or r.get('release_date') or ''));return int(match[0]) if match else 0
years=np.array([year(r) for r in rows]);prices=np.array([(r.get('price_overview') or {}).get('initial',0)/100 for r in rows])
def owners(value):
 nums=re.findall(r'[\d,]+',str(value or ''));nums=[float(n.replace(',','')) for n in nums];return sum(nums[:2])/len(nums[:2]) if nums else 0
pop=np.array([owners(enrichment[str(i)]['popularity'].get('owners')) for i in ids]);owner_known=np.array([bool(enrichment[str(i)]['popularity'].get('owners')) for i in ids])
def top(scores,k=200):
 # Exact score selection, deterministic appid tie-break including the boundary.
 chosen=np.argpartition(-scores,k-1)[:k];cut=scores[chosen].min();head=np.flatnonzero(scores>cut);ties=np.flatnonzero(scores==cut)[:k-len(head)];chosen=np.r_[head,ties];return chosen[np.lexsort((chosen,-scores[chosen]))]
path=a.artifacts/'slates.progress.jsonl';manifest=a.artifacts/'scoring-inputs.json'
inputs={str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in [a.source/'data/catalog.json',a.source/'data/steam_tags.json',a.model/'ranker.txt',a.artifacts/'ids.json',ROOT/'scripts/relaunch/catalog.py',ROOT/'scripts/relaunch/selection.py',pathlib.Path(__file__)]}
if manifest.exists():assert json.loads(manifest.read_text())==inputs,'Dataset changed; use a new artifacts directory'
else:manifest.write_text(json.dumps(inputs))
done=set()
if path.exists():
 lines=path.read_bytes().splitlines(keepends=True);offset=0
 for index,line in enumerate(lines):
  try:done.add(json.loads(line)['source_appid'])
  except json.JSONDecodeError:
   assert index==len(lines)-1,'Corrupt interior journal record'
   with path.open('r+b') as journal:journal.truncate(offset)
   print('Recovered interrupted final journal record',flush=True);break
  offset+=len(line)
with path.open('a') as out:
 for start in range(0,len(rows),16):
  seeds=np.array([i for i in range(start,min(start+16,len(rows))) if ids[i] not in done]);
  if not len(seeds):continue
  feats=model.features(seeds);hand=model.combine(feats,seeds)
  flat=feats['steam_tag'].copy();flat[:,~mask]=-np.inf
  bge=E[seeds]@E.T;bge[:,~mask]=-np.inf
  for j,i in enumerate(seeds):
   flat[j,i]=bge[j,i]=-np.inf
   A=top(flat[j]);B=top(bge[j]);c=np.union1d(A,B);assert np.isfinite(hand[j,c]).all()
   features=np.column_stack((E[c]@E[i],(linear[c]@linear[i].T).toarray().ravel(),feats['steam_tag'][j,c],hand[j,c],np.isin(c,A),np.isin(c,B),[bool(dev[i]&dev[t]) for t in c],[bool(pub[i]&pub[t]) for t in c],np.log1p(reviews[c])-np.log1p(reviews[i]),np.abs(np.log1p(reviews[c])-np.log1p(reviews[i])),np.log1p(reviews[c]),np.full(len(c),np.log1p(reviews[i])),ratios[c],np.abs(years[c]-years[i]),np.abs(prices[c]-prices[i]),known[c],np.full(len(c),known[i]),years[c]>0,np.full(len(c),years[i]>0),(np.log1p(pop[c])-np.log1p(pop[i]))*owner_known[c]*owner_known[i],owner_known[c],np.full(len(c),owner_known[i])))
   assert features.shape[1]==ranker.num_feature()==22
   values=ranker.predict(features,num_threads=2);ordered=c[np.lexsort((c,-values))]
   selected=np.array(select_targets(ordered,reviews),dtype=int)
   assert len(selected)==10 and mask[selected].all() and i not in selected
   slate={'source_appid':ids[i],'model':MODEL_VERSION,'ranked_candidates':[ids[t] for t in ordered],'suggestions':[{'rank':rank,'suggested_appid':ids[t]} for rank,t in enumerate(selected,1)]}
   out.write(json.dumps(slate)+'\n')
  out.flush()
  if start%1024==0:print('ranked',min(start+16,len(rows)),'/',len(rows),flush=True)
target=a.source/'slates_indie.jsonl';tmp=target.with_suffix('.tmp');tmp.write_bytes(path.read_bytes());tmp.replace(target);print('Ranking complete',len(rows),flush=True)
