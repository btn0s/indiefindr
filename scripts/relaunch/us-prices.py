"""Acquire canonical US app prices, including preserved legacy pages.

Batched price_overview is the store's app price, not a bundle purchase option.
Raw responses remain resumable on disk; no foreign or stale fallback is used.
"""
import argparse,datetime,hashlib,json,pathlib,time
import requests
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);a=p.parse_args()
ids=sorted(r['appid'] for r in json.loads((a.source/'data/catalog.json').read_text())['rows'])
root=pathlib.Path('data/steam-full/us-prices');root.mkdir(parents=True,exist_ok=True)
day=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d');prices={};session=requests.Session()
for start in range(0,len(ids),100):
 batch=ids[start:start+100];digest=hashlib.sha256(json.dumps(batch).encode()).hexdigest();path=root/f'{day}-{digest}.json'
 if path.exists():response=json.loads(path.read_text())
 else:
  for attempt in range(7):
   try:
    r=session.get('https://store.steampowered.com/api/appdetails',params={'appids':','.join(map(str,batch)),'cc':'us','filters':'price_overview'},timeout=60)
    if r.status_code==429 or r.status_code>=500:time.sleep(max(10,2**attempt));continue
    r.raise_for_status();response=r.json();assert isinstance(response,dict) and all(str(i) in response for i in batch)
    break
   except (requests.RequestException,ValueError,AssertionError):
    if attempt==6:raise
    time.sleep(2**attempt)
  else:raise RuntimeError('US price request retry budget exhausted')
  tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(response));tmp.replace(path);time.sleep(1.6)
 for appid in batch:
  item=response[str(appid)];price=(item.get('data') or {}).get('price_overview') if item.get('success') else None
  assert not price or price.get('currency')=='USD',f'Non-US price for {appid}'
  prices[str(appid)]=price
 if start%1000==0:print('US prices',min(start+100,len(ids)),'/',len(ids),flush=True)
path=root.parent/'us-prices.json';tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(prices));tmp.replace(path)
print('US prices complete',len(prices),flush=True)
