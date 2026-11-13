"""Prepare compact import files from COPIES of the frozen exports; no network writes."""
import argparse,json,pathlib,re,unicodedata,datetime
p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('--catalog-only',action='store_true');p.add_argument('--out',type=pathlib.Path,default=pathlib.Path('data/relaunch'));a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
from catalog import is_indie
rows=json.loads((a.source/'data/catalog.json').read_text())['rows'];tags=json.loads((a.source/'data/steam_tags.json').read_text());games=[]
for r in rows:
 t=tags.get(str(r['appid']),{}); genre=[g['description'] if isinstance(g,dict) else g for g in (r.get('genres') or [])];pub=r.get('publishers') or []; ids=[x['tagid'] for x in t.get('tags',[]) if 'tagid' in x];pop=t.get('popularity',{})
 indie=is_indie(r,t.get('tags',[]))
 slug=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',r['title']).encode('ascii','ignore').decode().lower()).strip('-') or 'game'
 games.append(dict(appid=r['appid'],slug=f'{slug}-{r["appid"]}',title=r['title'],short_description=r.get('short_description'),header_image=r.get('header_image'),release_date=r.get('steam_release_date'),developers=r.get('developers') or [],publishers=pub,genres=genre,price_cents=(r.get('price_overview') or {}).get('final'),is_free=bool(r.get('is_free')),steam_type=r.get('steam_type'),review_count=pop.get('review_count') or 0,review_positive_pct=round(pop['percent_positive']) if pop.get('percent_positive') is not None else None,tag_ids=ids,is_indie=indie,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat()))
byid={g['appid']:g for g in games};recs=[];empty={}
for source,slates in ([] if a.catalog_only else [('model',[json.loads(l) for l in (a.source/'slates_indie.jsonl').open()]),('llm',json.loads((a.source/'llm_slates.json').read_text())['slates'])]):
 empty[source]=0
 for slate in slates:
  rank=0;seen=set()
  for s in slate['suggestions']:
   target=s['suggested_appid']
   if target in seen or target==slate['source_appid'] or not byid.get(target,{}).get('is_indie'):continue
   seen.add(target);rank+=1;recs.append(dict(appid=slate['source_appid'],rank=rank,rec_appid=target,source=source,model_version=slate.get('model','lambdarank_merged-indie-20261113') if source=='model' else 'llm-archive-20260615'))
  empty[source]+=rank==0
for name,data in [('games',games),('game_recs',recs),('tags',[{'id':t['tagid'],'name':t['name']} for t in json.loads((a.source/'data/steam_tag_names.json').read_text())['response']['tags']])]:
 with (a.out/(name+'.jsonl')).open('w') as f:
  for row in data:f.write(json.dumps(row)+'\n')
report={'games':len(games),'indie':sum(g['is_indie'] for g in games),'recs':len(recs),'empty_after_indie_filter':empty};(a.out/'manifest.json').write_text(json.dumps(report,indent=2));print(report)
