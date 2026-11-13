"""Compare a complete prepared slate generation with its published predecessor."""
import argparse,collections,json,pathlib
from review_quality import eligible,rated_low
p=argparse.ArgumentParser();p.add_argument('--old',type=pathlib.Path,required=True);p.add_argument('--new',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,required=True);a=p.parse_args()
games={g['appid']:g for g in (json.loads(l) for l in (a.new/'games.jsonl').open())};quality=json.loads((a.source/'review-quality.json').read_text())
counts=collections.Counter();before=collections.Counter();after=collections.Counter();changed=0;old_slates={}
for line in (a.old/'game_recs.jsonl').open():
 r=json.loads(line);counts[r['rec_appid']]+=1;before[r['source']]+=1
 old_slates.setdefault((r['appid'],r['source']),[]).append(r['rec_appid'])
invalid=[];rescued=[]
for appid,n in counts.most_common():
 g=games.get(appid)
 if not g:continue
 q=quality[str(appid)]
 item=dict(appid=appid,title=g['title'],recommendation_rows=n,steam_score=g['review_positive_pct'],clean_score=g['clean_score'],review_count=g['review_count'],bomb_windows=q['bomb_windows'],histogram_url=f'https://store.steampowered.com/appreviewhistogram/{appid}?l=english&review_score_preference=0')
 if not eligible(g):invalid.append(item)
 elif rated_low(g['review_positive_pct'],g['review_count']):rescued.append(item)
slates={};unrated=collections.Counter()
for line in (a.new/'game_recs.jsonl').open():
 r=json.loads(line);g=games[r['rec_appid']];assert eligible(g),r;after[r['source']]+=1
 slates.setdefault((r['appid'],r['source']),[]).append(r['rec_appid'])
 if g['review_count']<10 or g['review_positive_pct'] is None:unrated[r['rec_appid']]+=1
for key,targets in slates.items():
 assert len(targets)==10 and len(set(targets))==10,(key,len(targets))
 changed+=targets!=old_slates.get(key)
report=dict(dropped_unique_targets=len(invalid),dropped_recommendation_rows=sum(r['recommendation_rows'] for r in invalid),rescued_unique_targets=len(rescued),rescued_recommendation_rows=sum(r['recommendation_rows'] for r in rescued),before_rows=before,after_rows=after,changed_slates=changed,total_slates=len(slates),unrated_targets_retained=len(unrated),unrated_recommendation_rows=sum(unrated.values()),top_dropped=invalid[:10],top_rescued=rescued[:10],histogram_unavailable=sum(bool(q.get('unavailable')) for q in quality.values()),date_basis='Steam bucket timestamps, displayed in America/Los_Angeles; start/end inclusive. Resolution recorded per window.')
(a.new/'review-impact.json').write_text(json.dumps(report,indent=2))
lines=['# Review-quality slate impact','',f"Dropped {len(invalid):,} unique previously recommended targets ({report['dropped_recommendation_rows']:,} rows); rescued {len(rescued):,} targets ({report['rescued_recommendation_rows']:,} rows).",f"Every one of {len(slates):,} resulting slates has ten unique eligible targets. Unrated games remain eligible ({len(unrated):,} distinct targets in the resulting slates).",'',report['date_basis'],'']
for title,items in [('Most-recommended dropped games',invalid[:10]),('Most-recommended rescued games',rescued[:10])]:
 lines += ['## '+title,'','| Game | Previous rec rows | Steam | Clean | Detected windows (Pacific display dates) |','| --- | ---: | ---: | ---: | --- |']
 for r in items:
  windows='; '.join(f"{w['start']}–{w['end']} ({w['resolution']}; +{w['up']:,}/−{w['down']:,})" for w in r['bomb_windows']) or 'None'
  clean='—' if r['clean_score'] is None else f"{r['clean_score']:.1f}%"
  lines.append(f"| [{r['title']}]({r['histogram_url']}) ({r['appid']}) | {r['recommendation_rows']:,} | {r['steam_score']}% | {clean} | {windows} |")
 lines.append('')
(a.new/'review-impact.md').write_text('\n'.join(lines));print(json.dumps({k:v for k,v in report.items() if k not in ('top_dropped','top_rescued')},indent=2))
