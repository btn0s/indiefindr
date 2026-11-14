"""Refresh default Steam summaries nightly, including unchanged store pages.

The app-list modification timestamp is not a reliable review-change signal.
Fetch compact summaries in 100-app batches before comparing previous scores.
"""
import argparse,json,pathlib,time,urllib.request,urllib.error,urllib.parse
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);a=p.parse_args()
path=a.source/'data/steam_tags.json';tags=json.loads(path.read_text());ids=sorted(map(int,tags))
for start in range(0,len(ids),100):
 batch=ids[start:start+100]
 payload={'ids':[{'appid':i} for i in batch],'context':{'language':'english','country_code':'US','steam_realm':1},'data_request':{'include_reviews':True}}
 url='https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json='+urllib.parse.quote(json.dumps(payload,separators=(',',':')))
 for attempt in range(7):
  try:
   with urllib.request.urlopen(url,timeout=60) as response:items=json.load(response)['response'].get('store_items',[])
   break
  except (urllib.error.URLError,TimeoutError,ValueError) as error:
   if attempt==6:raise
   delay=min(120,2**(attempt+2))
   if isinstance(error,urllib.error.HTTPError) and error.code==429:
    try:delay=max(delay,float(error.headers.get('Retry-After') or 60))
    except ValueError:delay=max(delay,60)
   time.sleep(delay)
 for item in items:
  summary=(item.get('reviews') or {}).get('summary_filtered')
  if item.get('success')==1 and summary is not None:
   tags[str(item['id'])]['popularity'].update(review_count=summary.get('review_count',0),percent_positive=summary.get('percent_positive'))
 if start%10000==0:print('Review summaries',min(start+100,len(ids)),'/',len(ids),flush=True)
 time.sleep(.25)
tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(tags));tmp.replace(path)
