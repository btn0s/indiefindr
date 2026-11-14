"""Resumable, rate-limited histogram enrichment on the offline ingest host.

One fetch per game serves both review-bomb checks (rated-low or dropped games) and Rising momentum
(recent indie candidates below the indie+ line)."""
import argparse,datetime,json,pathlib,time,threading,urllib.request,urllib.error,fcntl
from concurrent.futures import ThreadPoolExecutor,as_completed
from review_quality import analyze,rated_low,momentum,VERSION,TREND_MIN_REVIEWS,TREND_MIN_POSITIVE,TREND_MAX_AGE_DAYS
from selection import INDIE_PLUS_REVIEWS
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('data/review-histograms'));p.add_argument('--refresh',action='store_true');p.add_argument('--workers',type=int,default=4);p.add_argument('--interval',type=float,default=.5);a=p.parse_args();a.cache.mkdir(parents=True,exist_ok=True)
fetch_lock=(a.cache/'fetch.lock').open('a')
fcntl.flock(fetch_lock,fcntl.LOCK_EX)
tags=json.loads((a.source/'data/steam_tags.json').read_text());output=a.source/'review-quality.json'
previous=json.loads(output.read_text()) if output.exists() else {};results={};pending=[]
now=datetime.datetime.now(datetime.timezone.utc);today=now.date().isoformat()
# Rising age runs from the later of first review and steam_release_date (an early-access 1.0 counts as a launch),
# so only indies released, or released from early access, within the window need a histogram.
trend_since=(now.date()-datetime.timedelta(days=TREND_MAX_AGE_DAYS)).isoformat()
recent_indies={str(r['appid']):r.get('steam_release_date') for r in json.loads((a.source/'data/catalog.json').read_text())['rows'] if r.get('is_indie') and (r.get('steam_release_date') or '9999')>=trend_since}
for key,tag in tags.items():
 pop=tag.get('popularity') or {};score=pop.get('percent_positive');count=pop.get('review_count') or 0;old=previous.get(key,{})
 dropped=old.get('default_score') is not None and score is not None and old['default_score']-score>15
 quality=rated_low(score,count) or dropped
 trend=key in recent_indies and TREND_MIN_REVIEWS<=count<INDIE_PLUS_REVIEWS and score is not None and score>=TREND_MIN_POSITIVE
 if not quality and not trend:
  results[key]=dict(clean_score=score,bomb_windows=[],checked_at=now.isoformat(),default_score=score,trend=None)
  continue
 pending.append((key,score,quality,trend))
print('Histogram candidates',len(pending),flush=True)
lock=threading.Lock();next_request=0.;cooldown=0.
def save(path,value):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value));tmp.replace(path)
def fetch(job):
 global next_request,cooldown
 key,score,quality,trend=job;path=a.cache/(key+'.json');cached=json.loads(path.read_text()) if path.exists() else None
 valid=cached and isinstance(cached.get('payload'),dict) and (not a.refresh or cached['checked_at'][:10]==today)
 if not valid:
  for attempt in range(7):
   with lock:
    start=max(time.monotonic(),next_request,cooldown);next_request=start+a.interval
   time.sleep(max(0,start-time.monotonic()))
   try:
    request=urllib.request.Request(f'https://store.steampowered.com/appreviewhistogram/{int(key)}?l=english&review_score_preference=0',headers={'User-Agent':'indiefindr-offline/1.0'})
    with urllib.request.urlopen(request,timeout=45) as response:payload=json.load(response)
    cached=dict(version=VERSION,checked_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),payload=payload);save(path,cached);break
   except (urllib.error.URLError,TimeoutError,ValueError) as error:
    wait=min(300,2**(attempt+2))
    if isinstance(error,urllib.error.HTTPError) and error.code==429:
     try:wait=max(wait,float(error.headers.get('Retry-After') or 60))
     except ValueError:wait=max(wait,60)
     with lock:cooldown=max(cooldown,time.monotonic()+wait)
    if attempt==6:return key,None
    time.sleep(wait)
 try:result=analyze(cached['payload'],score) if quality else dict(clean_score=score,bomb_windows=[])
 except ValueError as error:result=dict(clean_score=score,bomb_windows=[],unavailable=str(error),detector_version=VERSION)
 try:result['trend']=momentum(cached['payload'],score,now,recent_indies[key]) if trend else None
 except ValueError:result['trend']=None
 result.update(checked_at=cached['checked_at'],default_score=score)
 return key,result
failures=[]
with ThreadPoolExecutor(max_workers=max(1,min(a.workers,4))) as pool:
 futures=[pool.submit(fetch,job) for job in pending]
 for completed,future in enumerate(as_completed(futures),1):
  key,result=future.result()
  if result is None:failures.append(key)
  else:results[key]=result
  if completed%100==0:
   save(output,results);print('Histograms',completed,'/',len(pending),'failed',len(failures),flush=True)
save(output,results)
save(a.source/'review-quality-status.json',dict(complete=not failures,failed=failures,candidates=len(pending),checked_at=now.isoformat(),version=VERSION))
assert not failures,f'Histogram checks incomplete for {len(failures)} games; rerun to resume'
print('Histogram checks complete',len(pending),flush=True)
