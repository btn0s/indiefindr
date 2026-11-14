"""Publish compact chart series from cached histograms; never refetch at request time."""
import argparse,calendar,datetime,json,pathlib,urllib.request
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('data/review-histograms'));a=p.parse_args()
v=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=v['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
r=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/api-keys',headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN']})
with urllib.request.urlopen(r,timeout=60) as response:keys=json.load(response)
key=next(k['api_key'] for k in keys if k['name']=='service_role');quality=json.loads((a.source/'review-quality.json').read_text());published=0
for appid,q in quality.items():
 if q.get('default_score') is None or q['default_score']>=70 or (q.get('clean_score') or 0)<70 or not q.get('bomb_windows'):continue
 payload=json.loads((a.cache/(appid+'.json')).read_text());data=payload['payload']['results'];kind=data.get('rollup_type','week');rows=data.get('rollups') or data.get('recent') or [];kind=kind if data.get('rollups') else 'day';periods=[]
 for row in rows:
  start=int(row['date']);stamp=datetime.datetime.fromtimestamp(start,datetime.timezone.utc);days=calendar.monthrange(stamp.year,stamp.month)[1] if kind=='month' else 7 if kind=='week' else 1
  end=min(start+days*86400,int(data.get('end_date') or start+days*86400)+86400)
  periods.append(dict(start=start,end=end,up=int(row.get('recommendations_up',0)),down=int(row.get('recommendations_down',0))))
 body=json.dumps(dict(appid=int(appid),granularity=kind,checked_at=payload['checked_at'],periods=periods)).encode()
 request=urllib.request.Request(f'https://{ref}.supabase.co/storage/v1/object/search/review-history/{appid}.json',data=body,method='POST',headers={'Authorization':'Bearer '+key,'apikey':key,'Content-Type':'application/json','x-upsert':'true','Cache-Control':'max-age=3600'})
 with urllib.request.urlopen(request,timeout=60) as response:response.read()
 published+=1
print('Published review-history charts:',published)
