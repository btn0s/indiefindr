"""Resumable, rate-limited review-bomb checks on the offline ingest host.

Every rated-low (or sharply dropped) game gets one histogram read; only games
with a candidate window get GetAppReviews reads. Raw responses stay on disk.
Games with an open window (active_bomb / unresolved) are re-judged every run,
whatever their score, until hindsight confirms or flips the verdict.
The same histogram read serves review momentum for the Rising (recent indie launches) and
Early Access (indies still in early access, any age) shelves, below the indie+ line.
Needs the recommender venv (sentence-transformers) and the topic model in HF_HOME.
"""
import argparse,datetime,fcntl,json,pathlib,threading
from concurrent.futures import ThreadPoolExecutor,as_completed
from review_quality import analyze,detect,needs_reviews,open_windows,rated_low,momentum,VERSION,TREND_MIN_REVIEWS,TREND_MIN_POSITIVE,TREND_MAX_AGE_DAYS
from selection import INDIE_PLUS_REVIEWS
from review_topics import off_game
from steam_reviews import Steam,gather
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('data/review-cache'));p.add_argument('--refresh',action='store_true');p.add_argument('--offline',action='store_true',help='cached responses only; no network');p.add_argument('--workers',type=int,default=4);p.add_argument('--interval',type=float,default=.5,help='seconds between store histogram requests');p.add_argument('--api-interval',type=float,default=.35,help='seconds between GetAppReviews requests');a=p.parse_args();a.cache.mkdir(parents=True,exist_ok=True)
fetch_lock=(a.cache/'fetch.lock').open('a')
fcntl.flock(fetch_lock,fcntl.LOCK_EX)
steam=Steam(a.cache,store_interval=a.interval,api_interval=a.api_interval,offline=a.offline)
tags=json.loads((a.source/'data/steam_tags.json').read_text());output=a.source/'review-quality.json'
previous=json.loads(output.read_text()) if output.exists() else {};results={};pending=[]
now=datetime.datetime.now(datetime.timezone.utc)
# Rising age runs from the later of first review and steam_release_date (an early-access 1.0 counts as a launch),
# so only indies released, or released from early access, within the window need a histogram.
trend_since=(now.date()-datetime.timedelta(days=TREND_MAX_AGE_DAYS)).isoformat()
# Early Access games trend at any age, so their momentum skips the age gate.
rows=[r for r in json.loads((a.source/'data/catalog.json').read_text())['rows'] if r.get('is_indie')]
recent_indies={str(r['appid']):r.get('steam_release_date') for r in rows if r.get('is_early_access') or (r.get('steam_release_date') or '9999')>=trend_since}
early_access={str(r['appid']) for r in rows if r.get('is_early_access')}
for key,tag in tags.items():
 pop=tag.get('popularity') or {};score=pop.get('percent_positive');count=pop.get('review_count') or 0;old=previous.get(key,{})
 dropped=old.get('default_score') is not None and score is not None and old['default_score']-score>15
 quality=rated_low(score,count) or dropped or bool(open_windows(old))
 trend=key in recent_indies and TREND_MIN_REVIEWS<=count<INDIE_PLUS_REVIEWS and score is not None and score>=TREND_MIN_POSITIVE
 if not quality and not trend:
  results[key]=dict(clean_score=score,bomb_windows=[],checked_at=now.isoformat(),default_score=score,trend=None)
  continue
 pending.append((key,score,count,quality,trend))
print('Histogram candidates',len(pending),flush=True)
def save(path,value):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value));tmp.replace(path)
topic_lock=threading.Lock()
def topics(texts):
 with topic_lock:return off_game(texts)
def check(job):
 key,score,count,quality,trend=job
 try:
  cached=steam.histogram(key,refresh=a.refresh)
  if quality:
   _,windows=detect(cached['payload'])
   result=analyze(cached['payload'],score,gather(steam,key,windows,needs_reviews,refresh=a.refresh,total=count),topics=topics)
  else:result=dict(clean_score=score,bomb_windows=[])
 except ValueError as error:
  result=dict(clean_score=score,bomb_windows=[],unavailable=str(error),detector_version=VERSION);cached=dict(fetched_at=now.isoformat())
 except Exception as error:
  print('failed',key,error,flush=True);return key,None
 try:result['trend']=momentum(cached['payload'],score,now,recent_indies[key],None if key in early_access else TREND_MAX_AGE_DAYS) if trend and 'payload' in cached else None
 except ValueError:result['trend']=None
 result.update(checked_at=cached['fetched_at'],default_score=score)
 return key,result
failures=[]
with ThreadPoolExecutor(max_workers=max(1,min(a.workers,8))) as pool:
 futures=[pool.submit(check,job) for job in pending]
 for completed,future in enumerate(as_completed(futures),1):
  key,result=future.result()
  if result is None:failures.append(key)
  else:results[key]=result
  if completed%500==0:
   save(output,results);print('Checked',completed,'/',len(pending),'failed',len(failures),flush=True)
save(output,results)
save(a.source/'review-quality-status.json',dict(complete=not failures,failed=failures,candidates=len(pending),checked_at=now.isoformat(),version=VERSION))
assert not failures,f'Review checks incomplete for {len(failures)} games; rerun to resume'
print('Review checks complete',len(pending),'adjusted',sum(bool(r.get('bomb_windows')) for r in results.values()),flush=True)
