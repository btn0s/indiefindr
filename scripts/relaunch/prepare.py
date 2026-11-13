"""Prepare compact import files from COPIES of the frozen exports; no network writes."""
import argparse,json,pathlib,re,unicodedata,datetime
p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('--prices',type=pathlib.Path,default=pathlib.Path('data/steam-full/us-prices.json'));p.add_argument('--catalog-only',action='store_true');p.add_argument('--out',type=pathlib.Path,default=pathlib.Path('data/relaunch'));a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
from catalog import is_indie
from review_quality import eligible
from selection import MODEL_VERSION, select_targets
quality=json.loads((a.source/"review-quality.json").read_text())
assert json.loads((a.source/"review-quality-status.json").read_text())["complete"], "Finish histogram checks before preparation"
prices=json.loads(a.prices.read_text())
assert all(price is None or price.get('currency')=='USD' for price in prices.values()),'Only canonical US prices may be published'
tag_names=json.loads((a.source/'data/steam_tag_names.json').read_text())['response']['tags']
tag_ids_by_name={t['name'].casefold():t['tagid'] for t in tag_names}
rows=json.loads((a.source/'data/catalog.json').read_text())['rows'];tags=json.loads((a.source/'data/steam_tags.json').read_text());games=[]
for r in rows:
 t=tags.get(str(r['appid']),{}); genre=[g['description'] if isinstance(g,dict) else g for g in (r.get('genres') or [])];pub=r.get('publishers') or []; ids=list(dict.fromkeys(i for x in t.get('tags',[]) if (i:=x.get('tagid') or tag_ids_by_name.get(x.get('name','').casefold())) is not None));pop=t.get('popularity',{})
 indie=is_indie(r,t.get('tags',[]))
 slug=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',r['title']).encode('ascii','ignore').decode().lower()).strip('-') or 'game'
 games.append(dict(appid=r['appid'],slug=f'{slug}-{r["appid"]}',title=r['title'],short_description=r.get('short_description'),header_image=r.get('header_image'),release_date=r.get('steam_release_date'),developers=r.get('developers') or [],publishers=pub,genres=genre,price_cents=(prices[str(r['appid'])] or {}).get('final'),is_free=bool(r.get('is_free')),steam_type=r.get('steam_type'),review_count=pop.get('review_count') or 0,review_positive_pct=round(pop['percent_positive']) if pop.get('percent_positive') is not None else None,tag_ids=ids,is_indie=indie,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat()))
for game in games:
 q=quality.get(str(game['appid']))
 assert q is not None, f"Missing review quality for {game['appid']}"
 game.update(clean_score=q['clean_score'],bomb_windows=q['bomb_windows'],checked_at=q['checked_at'])
byid={g['appid']:g for g in games};recs=[];empty={}
review_counts={g['appid']:g['review_count'] for g in games}
model_slates={s['source_appid']:s for s in (json.loads(l) for l in (a.source/'slates_indie.jsonl').open())} if not a.catalog_only else {}
def allowed(target, source):
 return target != source and target in byid and byid[target]['is_indie'] and eligible(byid[target])
for source,slates in ([] if a.catalog_only else [('model',model_slates.values()),('llm',json.loads((a.source/'llm_slates.json').read_text())['slates'])]):
 empty[source]=0
 for slate in slates:
  appid=slate['source_appid']
  if appid not in byid:continue
  candidates=model_slates[appid]['ranked_candidates']
  if source=='model':
   targets=select_targets([t for t in candidates if allowed(t,appid)],review_counts)
  else:
   targets=[]
   for target in [s['suggested_appid'] for s in slate['suggestions']]+candidates:
    if allowed(target,appid) and target not in targets:targets.append(target)
    if len(targets)==10:break
   assert len(targets)==10, f'Insufficient eligible candidates for {appid}'
  for rank,target in enumerate(targets,1):
   recs.append(dict(appid=appid,rank=rank,rec_appid=target,source=source,model_version=MODEL_VERSION if source=='model' else 'llm-archive-20260615-clean-v1'))
  empty[source]+=not targets
for name,data in [('games',games),('game_recs',recs),('tags',[{'id':t['tagid'],'name':t['name']} for t in json.loads((a.source/'data/steam_tag_names.json').read_text())['response']['tags']])]:
 with (a.out/(name+'.jsonl')).open('w') as f:
  for row in data:f.write(json.dumps(row)+'\n')
report={'games':len(games),'indie':sum(g['is_indie'] for g in games),'recs':len(recs),'empty_after_indie_filter':empty};(a.out/'manifest.json').write_text(json.dumps(report,indent=2));print(report)
