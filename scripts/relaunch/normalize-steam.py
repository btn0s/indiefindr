"""Convert cached Steam batch metadata to the offline scorer/catalog contracts."""
import argparse,json,pathlib,datetime,re,html
from catalog import is_indie
p=argparse.ArgumentParser();p.add_argument('--input',type=pathlib.Path,default=pathlib.Path('data/steam-full'));p.add_argument('--out',type=pathlib.Path,default=pathlib.Path('data/full-source'));p.add_argument('--previous',type=pathlib.Path);p.add_argument('--allow-partial',action='store_true');a=p.parse_args()
assert a.allow_partial or (a.input/'complete.json').exists(),'Backfill must finish before publication'
a.out.mkdir(exist_ok=True);(a.out/'data').mkdir(exist_ok=True)
old={r['appid']:r for r in json.loads(pathlib.Path('data/relaunch-source/data/catalog.json').read_text())['rows']}
oldtags=json.loads(pathlib.Path('data/relaunch-source/data/steam_tags.json').read_text())
if a.previous:
 old.update({r['appid']:r for r in json.loads((a.previous/'data/catalog.json').read_text())['rows']})
 oldtags.update(json.loads((a.previous/'data/steam_tags.json').read_text()))
genre_names={int(g['id']):g['description'] for r in old.values() for g in (r.get('genres') or [])}
category_names={int(c['id']):c['description'] for r in old.values() for c in (r.get('categories') or [])}
namesraw=json.loads((a.input/'tag_names.json').read_text())
for tag in namesraw['response']['tags']:tag['name']=html.unescape(tag['name'])
names={t['tagid']:t['name'] for t in namesraw['response']['tags']};rows={};enriched={};failed=[]
batch_names=json.loads((a.input/'batch_files.json').read_text()) if (a.input/'batch_files.json').exists() else None
files=[a.input/'batches'/name for name in batch_names] if batch_names is not None else sorted((a.input/'batches').glob('*.json'))
def plain_description(value):
 value=re.sub(r'\[(img|video|previewyoutube|previewmp4)[^\]]*\].*?\[/\1\]',' ',str(value or ''),flags=re.I|re.S)
 return re.sub(r'\[/?[a-zA-Z][^\]]*\]',' ',value).strip()
for f in files:
 for item in json.loads(f.read_text()).get('response',{}).get('store_items',[]):
  appid=item.get('id');canonical=item.get('appid')
  if item.get('success')!=1 or item.get('type')!=0 or not item.get('name') or appid!=canonical:
   failed.append(appid);continue
  info=item.get('basic_info') or {};r=dict(old.get(appid,{}));release=item.get('release') or {};timestamp=release.get('steam_release_date') or release.get('original_release_date');date=datetime.datetime.fromtimestamp(timestamp,datetime.timezone.utc).date().isoformat() if timestamp else None
  price=item.get('best_purchase_option') or {};cents=int(price['final_price_in_cents']) if 'final_price_in_cents' in price else None;initial=int(price.get('original_price_in_cents') or cents or 0)
  tags=[{'tagid':t['tagid'],'name':names[t['tagid']],'weight':t.get('weight',20-j),'rank':j+1} for j,t in enumerate(item.get('tags') or [{'tagid':i} for i in item.get('tagids',[])]) if t['tagid'] in names]
  summary=(item.get('reviews') or {}).get('summary_filtered') or {};review_count=summary.get('review_count',0)
  assets=item.get('assets') or {};asset_path=assets.get('asset_url_format','').replace('${FILENAME}',assets.get('header','header.jpg'))
  header='https://shared.akamai.steamstatic.com/store_item_assets/'+asset_path if asset_path.startswith('steam/') else 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/'+str(appid)+'/header.jpg'
  genreids=((item.get('extra_details') or {}).get('links_and_info') or {}).get('genreids')
  genres=[{'id':str(g),'description':genre_names.get(g,f'Genre {g}')} for g in genreids] if genreids is not None else (r.get('genres') or [])
  categoryids={c for group in (item.get('categories') or {}).values() for c in group}
  categories=[{'id':c,'description':category_names[c]} for c in sorted(categoryids) if c in category_names]
  r.update(appid=appid,title=item['name'],short_description=info.get('short_description') or r.get('short_description'),long_description=plain_description(item.get('full_description_bbcode')) or r.get('long_description'),header_image=header,developers=[d['name'] for d in info.get('developers',[])],publishers=[d['name'] for d in info.get('publishers',[])],release_date=date,steam_release_date=date,steam_type='game',price_overview={'currency':'USD','initial':initial,'final':cents} if cents is not None else None,is_free=bool(item.get('is_free')),recommendations={'total':review_count},genres=genres,categories=categories,content_descriptors={'ids':item.get('content_descriptorids') or (r.get('content_descriptors') or {}).get('ids') or []},steamspy_tags=r.get('steamspy_tags') or {})
  r['is_indie']=is_indie(r,tags);r['is_early_access']=bool(item.get('is_early_access') or release.get('is_early_access'))
  rows[appid]=r;enriched[str(appid)]={'appid':appid,'tags':tags,'popularity':{'review_count':review_count,'percent_positive':summary.get('percent_positive'),'owners':r.get('steamspy_owners')},'source':'IStoreBrowseService/GetItems'}
# Preserve legacy delisted/region-limited sources, whose stored pages must continue working.
preserved=0
for appid,r in old.items():
 if appid not in rows:
  r['price_overview']=None
  r['is_indie']=is_indie(r,oldtags[str(appid)]['tags'])
  rows[appid]=r;enriched[str(appid)]=oldtags[str(appid)];preserved+=1
# Steam returns some text HTML-escaped ("DU&amp;I"). Decode every Steam text field once, here, for fresh and
# preserved rows alike, so the site, search and developer joins all see the same plain string.
def decode(value):
 if isinstance(value,str):return html.unescape(value)
 if isinstance(value,list):return [decode(v) for v in value]
 if isinstance(value,dict):return {k:decode(v) if k in ('description','name') else v for k,v in value.items()}
 return value
for r in rows.values():
 for field in ('title','short_description','long_description','developers','publishers','genres','categories'):
  if field in r:r[field]=decode(r[field])
for entry in enriched.values():
 entry['tags']=[{**t,'name':html.unescape(t['name'])} if isinstance(t.get('name'),str) else t for t in entry.get('tags',[])]
for filename,value in [('catalog.json',{'rows':sorted(rows.values(),key=lambda r:r['appid']),'row_count':len(rows)}),('steam_tags.json',enriched),('steam_tag_names.json',namesraw)]:
 (a.out/'data'/filename).write_text(json.dumps(value))
print({'games':len(rows),'unavailable_or_non_game':len(failed),'preserved_legacy':preserved})
