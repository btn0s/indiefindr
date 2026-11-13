"""Offline media enrichment. Store normalized URLs, never the raw Steam blob."""
import argparse,hashlib,json,pathlib,time,urllib.request
import requests
ASSETS='https://shared.akamai.steamstatic.com/store_item_assets/'
VIDEO='https://video.akamai.steamstatic.com/store_trailers/'
def normalized_media(item):
 screenshots=(item.get('screenshots') or {}).get('all_ages_screenshots') or []
 screenshots=[ASSETS+s['filename'].lstrip('/') for s in sorted(screenshots,key=lambda s:s.get('ordinal',0))[:8]]
 trailers=[]
 for trailer in (item.get('trailers') or {}).get('highlights',[]):
  if trailer.get('all_ages') is False:continue
  hls=next((t['cdn_path'] for t in trailer.get('adaptive_trailers',[]) if t.get('encoding')=='hls_h264'),None)
  if not hls:continue
  screenshot=trailer.get('screenshot_full') or trailer.get('screenshot_medium')
  poster=ASSETS+trailer.get('trailer_url_format','steam/apps/${FILENAME}').replace('${FILENAME}',screenshot) if screenshot else None
  trailers.append({'title':trailer.get('trailer_name') or 'Trailer','url':VIDEO+hls,'poster':poster})
  if len(trailers)==2:break
 return {'appid':item['id'],'screenshots':screenshots,'trailers':trailers}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--top',type=int,default=100);a=p.parse_args()
 values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=values['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
 def query(sql):
  req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},data=json.dumps({'query':sql}).encode())
  with urllib.request.urlopen(req,timeout=120) as r:return json.load(r)
 games=query(f'select appid from public.games order by review_count desc,appid limit {max(1,min(a.top,250000))}')
 output=pathlib.Path('data/media-batches');output.mkdir(exist_ok=True)
 for start in range(0,len(games),100):
  batch=games[start:start+100];q={'ids':batch,'context':{'language':'english','country_code':'US','steam_realm':1},'data_request':{'include_screenshots':True,'include_trailers':True}}
  digest=hashlib.sha256(json.dumps(batch,sort_keys=True).encode()).hexdigest()
  path=output/(digest+'.json')
  if path.exists():response=json.loads(path.read_text())
  else:
   for attempt in range(6):
    r=requests.get('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/',params={'input_json':json.dumps(q)},timeout=60)
    if r.status_code==429 or r.status_code>=500:time.sleep(min(60,2**attempt));continue
    r.raise_for_status();response=r.json();break
   else:raise RuntimeError('Steam media retry budget exhausted')
   tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(response));tmp.replace(path)
  rows=[normalized_media(i) for i in response.get('response',{}).get('store_items',[]) if i.get('success')==1]
  data=json.dumps(rows).replace("'","''")
  query("update public.games g set screenshots=r.screenshots,trailers=r.trailers from jsonb_to_recordset('"+data+"'::jsonb) as r(appid integer,screenshots text[],trailers jsonb) where g.appid=r.appid")
  print('media updated',min(start+100,len(games)),flush=True);time.sleep(.3)
