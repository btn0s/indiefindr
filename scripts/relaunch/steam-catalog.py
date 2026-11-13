"""Free, resumable Steam catalog acquisition. Raw blobs stay on disk."""
import argparse,json,pathlib,time,datetime,os,threading
from concurrent.futures import ThreadPoolExecutor,as_completed
import requests
p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,default=pathlib.Path('data/steam-full'));p.add_argument('--list-only',action='store_true');p.add_argument('--refresh',action='store_true');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
values={}
if pathlib.Path('.env.steam').exists():
 for line in pathlib.Path('.env.steam').read_text().splitlines():
  if '=' in line:k,v=line.split('=',1);values[k]=v
key=os.environ.get('STEAM_API_KEY') or values.get('STEAM_API_KEY');assert key,'STEAM_API_KEY required'
local=threading.local();request_lock=threading.Lock();next_request=0.0
def get(endpoint,params):
 global next_request
 if not hasattr(local,'session'):
  local.session=requests.Session();local.session.headers['User-Agent']='indiefindr-catalog/1.0'
 for attempt in range(6):
  try:
   with request_lock:
    delay=max(0,next_request-time.monotonic());next_request=time.monotonic()+delay+0.25
   time.sleep(delay)
   r=local.session.get('https://api.steampowered.com/'+endpoint,params=params,timeout=60)
   if r.status_code==429 or r.status_code>=500:time.sleep(min(60,max(float(r.headers.get('Retry-After') or 0),2**attempt)));continue
   if not r.ok:raise RuntimeError(f'Steam HTTP {r.status_code}')
   return r.json()
  except (requests.RequestException,ValueError):
   if attempt==5:raise RuntimeError('Steam request failed; secret URL withheld') from None
   time.sleep(2**attempt)
 raise RuntimeError('Steam retry budget exhausted')
def save(path,value):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value));tmp.replace(path)
listfile=a.out/'applist.json'
previous={x['appid']:x.get('last_modified') for x in json.loads(listfile.read_text())} if listfile.exists() else {}
if listfile.exists() and not a.refresh:apps=json.loads(listfile.read_text())
else:
 apps=[];last=0
 while True:
  page=get('IStoreService/GetAppList/v1/',{'key':key,'include_games':'true','include_dlc':'false','include_software':'false','include_videos':'false','include_hardware':'false','max_results':50000,'last_appid':last})['response']
  apps.extend(page.get('apps',[]));print('listed',len(apps),flush=True)
  if not page.get('have_more_results'):break
  newlast=page.get('last_appid') or max(x['appid'] for x in page['apps']);assert newlast>last;last=newlast;time.sleep(1)
 save(listfile,apps)
dirty={x['appid'] for x in apps if previous.get(x['appid'])!=x.get('last_modified')} if a.refresh else set()
pending=a.out/'pending_refresh.json'
dirty.update(json.loads(pending.read_text()) if pending.exists() else [])
save(pending,sorted(dirty))
print('Steam catalog appids',len(apps),'changed',len(dirty),flush=True)
if a.list_only:raise SystemExit
namesfile=a.out/'tag_names.json'
if not namesfile.exists():save(namesfile,get('IStoreService/GetTagList/v1/',{'input_json':json.dumps({'language':'english'})}))
cache=a.out/'batches';cache.mkdir(exist_ok=True);ids=sorted({int(x['appid']) for x in apps})
active=[];jobs=[]
(a.out/'complete.json').unlink(missing_ok=True)
for start in range(0,len(ids),100):
 batch=ids[start:start+100];path=cache/f'{batch[0]}-{batch[-1]}.json';active.append(path.name)
 existing=json.loads(path.read_text()) if path.exists() else None
 changed=any(i in dirty for i in batch)
 if existing and existing.get('_indiefindr_request_version')==2 and not changed:continue
 jobs.append((batch,path,existing,changed))
def fetch_batch(job):
 batch,path,existing,changed=job
 supplement=existing is not None and not changed
 request={'include_extra_details':True}
 if not supplement:request.update(include_tag_count=20,include_reviews=True,include_basic_info=True,include_assets=True,include_release=True,include_best_purchase_option=True,include_full_description=True)
 q={'ids':[{'appid':i} for i in batch],'context':{'language':'english','country_code':'US','steam_realm':1},'data_request':request}
 response=get('IStoreBrowseService/GetItems/v1/',{'input_json':json.dumps(q,separators=(',',':'))})
 if supplement:
  additions={i['id']:i for i in response.get('response',{}).get('store_items',[])}
  for item in existing.get('response',{}).get('store_items',[]):
   extra=additions.get(item['id'],{}).get('extra_details')
   if extra is not None:item['extra_details']=extra
  response=existing
 response['_indiefindr_request_version']=2;save(path,response)
 return batch
print('Metadata batches pending',len(jobs),flush=True)
with ThreadPoolExecutor(max_workers=4) as pool:
 futures=[pool.submit(fetch_batch,job) for job in jobs]
 for finished,future in enumerate(as_completed(futures),1):
  future.result()
  if finished%10==0:print('metadata batches',finished,'/',len(jobs),flush=True)
save(a.out/'batch_files.json',active)
save(a.out/'complete.json',{'apps':len(ids),'batches':len(list(cache.glob('*.json'))),'completed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
pending.unlink(missing_ok=True)
print('Backfill complete',flush=True)
