import hashlib,json,pathlib,threading,time,urllib.error,urllib.parse,urllib.request

HISTOGRAM='https://store.steampowered.com/appreviewhistogram/{appid}?l=english&review_score_preference=0'
REVIEWS='https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?'
AGENT={'User-Agent':'indiefindr-offline/1.0'}


class Throttle:
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
   if not refresh or cached['fetched_at'][:10]==time.strftime('%Y-%m-%d',time.gmtime()):return cached
  if self.offline:raise FileNotFoundError(path)
  body=dict(url=url,fetched_at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),payload=self._get(url,throttle))
  tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(body));tmp.replace(path)
  return body

 def histogram(self,appid,refresh=False):
  return self._cached(self.cache/'histogram'/f'{int(appid)}.json',HISTOGRAM.format(appid=int(appid)),self.store,refresh)

 def reviews(self,appid,*,start=None,end=None,offtopic=False,count_only=True,per_page=100,purchase_type=None,negative=False,refresh=False):
  params={'appid':int(appid),'languages[0]':'all','filter':1,'num_per_page':0 if count_only else per_page}
  if purchase_type is not None:params['purchase_type']=purchase_type
  if negative:params['review_type']=2
  if offtopic:params['filter_offtopic_activity']='false'
  if start is not None:params.update(date_range_start=int(start),date_range_end=int(end))
  url=REVIEWS+urllib.parse.urlencode(params)
  path=self.cache/'reviews'/(hashlib.sha1(url.encode()).hexdigest()+'.json')
  return self._cached(path,url,self.api,refresh)['payload']['response']

 def counts(self,appid,start=None,end=None,offtopic=False,purchase_type=None,refresh=False):
  s=self.reviews(appid,start=start,end=end,offtopic=offtopic,purchase_type=purchase_type,refresh=refresh).get('query_summary') or {}
  return int(s.get('total_positive') or 0),int(s.get('total_negative') or 0)

 def population(self,appid,total=None,refresh=False):
  default=self.counts(appid,refresh=refresh)
  if total is None:return None if sum(default) else 1
  every=self.counts(appid,purchase_type=1,refresh=refresh)
  return min(((None,default),(1,every)),key=lambda p:abs(sum(p[1])-total))[0]


SLICES=4


def gather(steam,appid,windows,needs,refresh=False,total=None):
 todo=[w for w in windows if needs(w)]
 if not todo:return {}
 population=steam.population(appid,total,refresh);out=dict(headline=steam.counts(appid,purchase_type=population,refresh=refresh),windows={})
 for w in todo:
  fresh=refresh and w['shape']['live']
  def sample(start,end):
   edges=[start+(end-start)*i//SLICES for i in range(SLICES+1)]
   return [r for a,b in zip(edges,edges[1:]) for r in steam.reviews(appid,start=a,end=b,offtopic=True,count_only=False,per_page=100//SLICES,purchase_type=1,negative=True,refresh=fresh).get('reviews') or []]
  out['windows'][w['start_ts']]=dict(steam=steam.counts(appid,w['start_ts'],w['end_ts'],purchase_type=population,refresh=fresh),
   reviews=sample(w['start_ts'],w['end_ts']),baseline=sample(w['start_ts']-365*86400,w['start_ts']))
 return out
