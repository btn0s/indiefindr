"""Upcoming shelf: Steam's most-wishlisted upcoming indies that have a real release date in the next six months.

Unreleased games have no reviews. Steam ranks them by wishlists (store search `filter=popularwishlist`, Indie tag).
The counts are private but the order is public. It is the platform's own measure of anticipation, hard to game,
and costs about 25 page requests. Demo reviews were too sparse to rank by (7 games met the Rising bar in
November 2026), so they only gate quality. A game is kept when our catalog classes it indie, Steam shows a day
or month release date within WINDOW_DAYS (no quarter, year or TBA placeholders), and, if its demo has at least
DEMO_MIN_REVIEWS reviews, the demo is at least 80% positive. Writes upcoming.json {appid: rank}, where 1 is the
most wishlisted game kept.
"""
import argparse,datetime,json,pathlib,re,time,urllib.error,urllib.parse,urllib.request
from review_quality import TREND_MIN_POSITIVE
WINDOW_DAYS=183;DEMO_MIN_REVIEWS=10;REAL_WINDOW={'date_full','date_month'}
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);a=p.parse_args()
def get(url):
 for attempt in range(7):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'indiefindr-offline/1.0'}),timeout=60) as response:return json.load(response)
  except (urllib.error.URLError,TimeoutError,ValueError) as error:
   if attempt==6:raise
   delay=min(120,2**(attempt+2))
   if isinstance(error,urllib.error.HTTPError) and error.code==429:delay=max(delay,60)
   time.sleep(delay)
def items(ids,request):
 found={}
 for start in range(0,len(ids),100):
  q={'ids':[{'appid':i} for i in ids[start:start+100]],'context':{'language':'english','country_code':'US','steam_realm':1},'data_request':request}
  response=get('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json='+urllib.parse.quote(json.dumps(q,separators=(',',':'))))
  found.update({item['id']:item for item in response['response'].get('store_items',[]) if item.get('success')==1});time.sleep(.25)
 return found
ranked=[]
while True:
 page=get('https://store.steampowered.com/search/results/?'+urllib.parse.urlencode(dict(filter='popularwishlist',tags=492,infinite=1,count=100,start=len(ranked),cc='us',l='english')))
 ids=[int(i) for i in re.findall(r'data-ds-appid="(\d+)"',page['results_html'])]
 ranked+=ids;time.sleep(.5)
 if not ids or len(ranked)>=page['total_count']:break
indie={r['appid'] for r in json.loads((a.source/'data/catalog.json').read_text())['rows'] if r.get('is_indie')}
candidates=[i for i in dict.fromkeys(ranked) if i in indie]
info=items(candidates,{'include_release':True,'include_related_items':True})
now=datetime.datetime.now(datetime.timezone.utc).timestamp();horizon=now+WINDOW_DAYS*86400
def dated(item):
 release=item.get('release') or {}
 return release.get('is_coming_soon') and release.get('coming_soon_display') in REAL_WINDOW and now<(release.get('steam_release_date') or 0)<=horizon
window=[i for i in candidates if i in info and dated(info[i])]
demos={i:((info[i].get('related_items') or {}).get('demo_appid') or [None])[0] for i in window}
demo_reviews={k:(v.get('reviews') or {}).get('summary_filtered') or {} for k,v in items([d for d in demos.values() if d],{'include_reviews':True}).items()}
def demo_ok(appid):
 summary=demo_reviews.get(demos[appid]) or {}
 return summary.get('review_count',0)<DEMO_MIN_REVIEWS or (summary.get('percent_positive') or 0)>=TREND_MIN_POSITIVE
kept=[i for i in window if demo_ok(i)]
assert len(ranked)>=500 and kept,f'Wishlist ranking looks broken: {len(ranked)} ranked, {len(kept)} kept'
out=a.source/'upcoming.json';tmp=out.with_suffix('.tmp');tmp.write_text(json.dumps({str(i):rank for rank,i in enumerate(kept,1)}));tmp.replace(out)
print({'wishlist_ranked':len(ranked),'indie':len(candidates),'release_window':len(window),'upcoming':len(kept)},flush=True)
