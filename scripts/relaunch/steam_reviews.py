"""Cached, rate-limited Steam review reads. Every raw response is kept on disk.

Two sources, both public and keyless:
- store.steampowered.com/appreviewhistogram/<appid>: the whole review history in
  one call (monthly/weekly rollups + 30 daily buckets) and Steam's own
  off-topic labels under `past_events`. Its counts are a different population
  from the headline score (they include non-Steam keys and keep a review's
  original vote and bucket), so they are used for shape, never for the score.
- api.steampowered.com/IUserReviewsService/GetAppReviews/v1: the replacement for
  the retired store `appreviews?json=1` endpoint (302 since 2026-10-22). With
  its default filters it reproduces the headline (`summary_filtered`), and it
  accepts a date range, so window counts come out in the headline's population.
"""
import hashlib,json,pathlib,threading,time,urllib.error,urllib.parse,urllib.request

HISTOGRAM='https://store.steampowered.com/appreviewhistogram/{appid}?l=english&review_score_preference=0'
REVIEWS='https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?'
AGENT={'User-Agent':'indiefindr-offline/1.0'}


class Throttle:
 """One shared request slot per host; a 429 pauses every worker on that host."""
 def __init__(self,interval):
  self.interval=interval;self.lock=threading.Lock();self.next=0.
 def wait(self):
  with self.lock:
   start=max(time.monotonic(),self.next);self.next=start+self.interval
  time.sleep(max(0,start-time.monotonic()))
 def cool(self,seconds):
  with self.lock:self.next=max(self.next,time.monotonic()+seconds)


class Steam:
 def __init__(self,cache,store_interval=.5,api_interval=.5,offline=False):
  self.cache=pathlib.Path(cache);self.offline=offline
  for d in ('histogram','reviews'):(self.cache/d).mkdir(parents=True,exist_ok=True)
  self.store=Throttle(store_interval);self.api=Throttle(api_interval)

 def _get(self,url,throttle):
  for attempt in range(7):
   throttle.wait()
   try:
    request=urllib.request.Request(url,headers=AGENT)
    with urllib.request.urlopen(request,timeout=45) as response:
     # A retired endpoint answers 302 to the store front; never read that as data.
     if response.geturl()!=url:raise RuntimeError(f'Steam redirected {url} to {response.geturl()}')
     return json.load(response)
   except (urllib.error.URLError,TimeoutError,ValueError) as error:
    wait=min(300,2**(attempt+2))
    if isinstance(error,urllib.error.HTTPError) and error.code==429:
     try:wait=max(wait,float(error.headers.get('Retry-After') or 60))
     except ValueError:wait=max(wait,60)
     throttle.cool(wait)
    if attempt==6:raise
    time.sleep(wait)

 def _cached(self,path,url,throttle,refresh=False):
  if path.exists():
   cached=json.loads(path.read_text())
   # refresh=True refetches anything not fetched today (UTC); resumable within a day.
   if not refresh or cached['fetched_at'][:10]==time.strftime('%Y-%m-%d',time.gmtime()):return cached
  if self.offline:raise FileNotFoundError(path)
  body=dict(url=url,fetched_at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),payload=self._get(url,throttle))
  tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(body));tmp.replace(path)
  return body

 def histogram(self,appid,refresh=False):
  return self._cached(self.cache/'histogram'/f'{int(appid)}.json',HISTOGRAM.format(appid=int(appid)),self.store,refresh)

 def reviews(self,appid,*,start=None,end=None,offtopic=False,count_only=True,per_page=100,purchase_type=None,negative=False,refresh=False):
  """One page. Defaults match the headline: all languages, Steam's purchase rule, off-topic filtered.

  `purchase_type=None` keeps Steam's default (Steam purchases) and falls back to
  all purchases when that is empty, which is how Steam scores free-to-play games.
  """
  params={'appid':int(appid),'languages[0]':'all','filter':1,'num_per_page':0 if count_only else per_page}
  if purchase_type is not None:params['purchase_type']=purchase_type
  if negative:params['review_type']=2
  if offtopic:params['filter_offtopic_activity']='false'
  if start is not None:params.update(date_range_start=int(start),date_range_end=int(end))
  url=REVIEWS+urllib.parse.urlencode(params)
  path=self.cache/'reviews'/(hashlib.sha1(url.encode()).hexdigest()+'.json')
  return self._cached(path,url,self.api,refresh)['payload']['response']

 def counts(self,appid,start=None,end=None,offtopic=False,purchase_type=None,refresh=False):
  """(up, down) in the headline population for [start, end)."""
  s=self.reviews(appid,start=start,end=end,offtopic=offtopic,purchase_type=purchase_type,refresh=refresh).get('query_summary') or {}
  return int(s.get('total_positive') or 0),int(s.get('total_negative') or 0)

 def population(self,appid,total=None,refresh=False):
  """Steam's scoring population: Steam purchases, or all purchases where Steam scores those.

  Free-to-play games score every purchase type: Apex Legends has 1.08M headline
  reviews but only ~1.6k from Steam purchases. With the headline's review count
  (`total`), pick whichever population reproduces it; without it, fall back to
  all purchases only when Steam purchases are empty.
  """
  default=self.counts(appid,refresh=refresh)
  if total is None:return None if sum(default) else 1
  every=self.counts(appid,purchase_type=1,refresh=refresh)
  return min(((None,default),(1,every)),key=lambda p:abs(sum(p[1])-total))[0]


SLICES=4


def gather(steam,appid,windows,needs,refresh=False,total=None):
 """GetAppReviews data the model needs for `windows` (see review_quality.analyze).

 Score counts use the headline population (`total` is the headline's review
 count, used to pick it). Evidence samples are negative
 reviews (who is complaining, and about what), spread over SLICES equal parts
 of the window so a short burst early in a long window is not missed, against
 the negative reviews of the year before. They include every purchase type and
 Steam's off-topic periods, so the reviews are judged blind to Steam's own label.
 """
 todo=[w for w in windows if needs(w)]
 if not todo:return {}
 # The all-time headline and still-open windows move daily; closed windows stay cached.
 population=steam.population(appid,total,refresh);out=dict(headline=steam.counts(appid,purchase_type=population,refresh=refresh),windows={})
 for w in todo:
  fresh=refresh and w['shape']['live']
  def sample(start,end):
   edges=[start+(end-start)*i//SLICES for i in range(SLICES+1)]
   return [r for a,b in zip(edges,edges[1:]) for r in steam.reviews(appid,start=a,end=b,offtopic=True,count_only=False,per_page=100//SLICES,purchase_type=1,negative=True,refresh=fresh).get('reviews') or []]
  out['windows'][w['start_ts']]=dict(steam=steam.counts(appid,w['start_ts'],w['end_ts'],purchase_type=population,refresh=fresh),
   reviews=sample(w['start_ts'],w['end_ts']),baseline=sample(w['start_ts']-365*86400,w['start_ts']))
 return out
