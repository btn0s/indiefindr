"""Score the review-bomb detector against ground truth, old (v2) model vs new.

Ground truth:
- fixtures/review-bomb-labels.json: press-sourced bombs and real declines.
  A model "adjusts" a labelled event when one of its adjusting windows overlaps
  the labelled dates (±31 days, since old history is in monthly buckets).
- Steam's own off-topic labels (`past_events` in every cached histogram). Recall
  only: an unflagged window may still be a bomb, so it cannot count against us.
The new model is always judged blind to Steam's labels so the labels can grade it.

Two settings for the labelled set:
- hindsight: the full history as it is today.
- judged at the time: history cut off LIVE_DAYS into the labelled window. The
  histogram keeps only periods that ended before the window; the window so far
  is one period counted from GetAppReviews (every purchase type and off-topic
  review, the closest match to the histogram's population). Only the live
  verdict counts (active_bomb adjusts), with no future data and no Steam label.

Writes data/review-eval/report.json and report.md; reads the catalog result
from <source>/review-quality.json for the old-vs-new adjusted counts.
"""
import argparse,datetime,json,pathlib,statistics
from review_quality import ADJUSTS,analyze,buckets,detect,detect_buckets,judge,needs_reviews,rated_low,steam_events,DAY
from review_topics import off_game
from steam_reviews import Steam,gather

LIVE_DAYS=21
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('data/review-cache'))
p.add_argument('--labels',type=pathlib.Path,default=pathlib.Path(__file__).parent/'fixtures/review-bomb-labels.json');p.add_argument('--out',type=pathlib.Path,default=pathlib.Path('data/review-eval'))
p.add_argument('--catalog',type=pathlib.Path,help='catalog.json with appid/title rows, for readable names');a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True);steam=Steam(a.cache,store_interval=.5,api_interval=.5)


def old_analyze(bs,default_score):
 """The v2 detector as shipped (steam-review-spikes-v2-negative-dominant), frozen here as the baseline."""
 daily=[b for b in bs if b['resolution']=='day']
 baseline=statistics.median([b['down'] for b in daily]) if daily else statistics.median([b['down']/((b['end']-b['start'])/DAY) for b in bs]) if bs else 0
 windows=[]
 for b in bs:
  if b['down']>=50 and b['down']>=10*baseline*(b['end']-b['start'])/DAY:
   if windows and windows[-1]['end_ts']==b['start']:w=windows[-1];w['end_ts']=b['end'];w['up']+=b['up'];w['down']+=b['down']
   else:windows.append(dict(start_ts=b['start'],end_ts=b['end'],up=b['up'],down=b['down']))
 windows=[w for w in windows if w['down']>w['up']]
 up=sum(b['up'] for b in bs)-sum(w['up'] for w in windows);down=sum(b['down'] for b in bs)-sum(w['down'] for w in windows)
 return dict(clean_score=100*up/(up+down) if windows and up+down>=10 else default_score,bomb_windows=windows)


def ts(text):return int(datetime.datetime.fromisoformat(text).replace(tzinfo=datetime.timezone.utc).timestamp())
def day(stamp):return datetime.datetime.fromtimestamp(stamp,datetime.timezone.utc).date().isoformat()
def overlaps(w,start,end,slack=31*DAY):return w['start_ts']<end+slack and start-slack<w['end_ts']


def blind(appid):
 payload=steam.histogram(appid)['payload'];_,windows=detect(payload)
 return payload,analyze(payload,None,gather(steam,appid,windows,needs_reviews),steam_labels=False,topics=off_game)


def at_the_time(appid,start):
 """Old and new verdicts with history cut off LIVE_DAYS into the window."""
 cut=start+LIVE_DAYS*DAY
 bs=[b for b in buckets(steam.histogram(appid)['payload']) if b['end']<=start]
 up,down=steam.counts(appid,start,cut,offtopic=True,purchase_type=1)
 bs.append(dict(start=start,end=cut,up=up,down=down,resolution='day'))
 _,windows=detect_buckets([dict(b) for b in bs])
 result=judge(bs,[],None,gather(steam,appid,windows,needs_reviews),off_game)
 hit=[w for w in result['review_events'] if w['polarity']=='negative' and w['end_ts']==cut]
 return dict(old=any(w['end_ts']==cut for w in old_analyze(bs,None)['bomb_windows']),new=any(w['verdict'] in ADJUSTS for w in hit),
  verdicts=[dict(verdict=w['verdict'],reason=w['reason'],evidence=w.get('evidence')) for w in hit],window_votes=(up,down))


def confusion(rows,key):
 tp=sum(r['label']=='bomb' and r[key] for r in rows);fn=sum(r['label']=='bomb' and not r[key] for r in rows)
 fp=sum(r['label']!='bomb' and r[key] for r in rows);tn=sum(r['label']!='bomb' and not r[key] for r in rows)
 return dict(tp=tp,fp=fp,fn=fn,tn=tn,precision=round(tp/(tp+fp),3) if tp+fp else None,recall=round(tp/(tp+fn),3) if tp+fn else None)


# 1. Hand-labelled press set, in hindsight and judged at the time.
hand=[];live=[]
for item in json.loads(a.labels.read_text()):
 start,end=ts(item['window_start']),ts(item['window_end'])+DAY
 payload,result=blind(item['appid'])
 hit=[w for w in result['review_events'] if w['polarity']=='negative' and overlaps(w,start,end)]
 hand.append(dict(appid=item['appid'],title=item['title'],label=item['label'],window=f"{item['window_start']}–{item['window_end']}",
  steam_flagged=any(overlaps(e,start,end,0) for e in steam_events(payload)),
  old=any(overlaps(w,start,end) for w in old_analyze(buckets(payload),None)['bomb_windows']),new=any(w['verdict'] in ADJUSTS for w in hit),
  verdicts=[dict(start=w['start'],end=w['end'],verdict=w['verdict'],reason=w['reason'],shape=w['shape'],evidence=w.get('evidence')) for w in hit],note=item.get('note')))
 if item['label'] in ('bomb','decline'):
  live.append(dict(appid=item['appid'],title=item['title'],label=item['label'],window=hand[-1]['window'],**at_the_time(item['appid'],start)))

# 2. Steam's own labels across every cached histogram.
events=[]
for path in sorted((a.cache/'histogram').glob('*.json')):
 payload=json.loads(path.read_text())['payload']
 if not payload.get('past_events') or payload.get('success')!=1:continue
 try:payload,result=blind(int(path.stem));old=old_analyze(buckets(payload),None)
 except ValueError:continue
 for e in steam_events(payload):
  hit=[w for w in result['review_events'] if w['polarity']=='negative' and overlaps(w,e['start_ts'],e['end_ts'],0)]
  events.append(dict(appid=int(path.stem),start=day(e['start_ts']),end=day(e['end_ts']-DAY),old=any(overlaps(w,e['start_ts'],e['end_ts'],0) for w in old['bomb_windows']),
   detected=bool(hit),new=any(w['verdict'] in ADJUSTS for w in hit),verdicts=[w['verdict'] for w in hit]))

# 3. Catalog impact: old model on the same cached histograms vs the new run's output.
tags=json.loads((a.source/'data/steam_tags.json').read_text());names={str(g['appid']):g.get('title') for g in json.loads(a.catalog.read_text())['rows']} if a.catalog else {};quality=json.loads((a.source/'review-quality.json').read_text())
c=dict(rated_low=0,old_adjusted=0,old_rescued=0,old_double_counted_steam_labels=0,new_adjusted=0,new_rescued=0,new_open_banners=0,new_active_bombs=0,steam_flagged_games=0);changes=[]
for key,q in quality.items():
 pop=tags[key].get('popularity') or {};score=pop.get('percent_positive')
 path=a.cache/'histogram'/f'{key}.json'
 if not rated_low(score,pop.get('review_count') or 0) or not path.exists():continue
 payload=json.loads(path.read_text())['payload']
 try:old=old_analyze(buckets(payload),score)
 except ValueError:continue
 adjusted=[w for w in q['bomb_windows'] if w.get('adjusted')]
 o=bool(old['bomb_windows']) and old['clean_score']>=70;n=bool(adjusted) and q['clean_score']>=70
 c['rated_low']+=1;c['old_adjusted']+=bool(old['bomb_windows']);c['old_rescued']+=o;c['new_adjusted']+=bool(adjusted);c['new_rescued']+=n
 c['old_double_counted_steam_labels']+=any(overlaps(w,e['start_ts'],e['end_ts'],0) for w in old['bomb_windows'] for e in steam_events(payload))
 c['new_open_banners']+=any(w['verdict']=='unresolved' for w in q['bomb_windows']);c['new_active_bombs']+=any(w['verdict']=='active_bomb' for w in adjusted)
 c['steam_flagged_games']+=bool(q.get('steam_events'))
 if o!=n:changes.append(dict(appid=int(key),title=names.get(key) or key,steam=score,old=round(old['clean_score'],1),new=round(q['clean_score'],1),old_rescued=o,new_rescued=n,
  reasons=[w['verdict']+': '+w['reason'] for w in q.get('review_events') or [] if w['polarity']=='negative']))

report=dict(hand=dict(cases=len(hand),bombs=sum(r['label']=='bomb' for r in hand),old=confusion(hand,'old'),new=confusion(hand,'new'),rows=hand),
 at_the_time=dict(days=LIVE_DAYS,cases=len(live),old=confusion(live,'old'),new=confusion(live,'new'),rows=live),
 steam_labels=dict(events=len(events),games=len({e['appid'] for e in events}),old_recall=round(sum(e['old'] for e in events)/len(events),3) if events else None,
  new_detected=round(sum(e['detected'] for e in events)/len(events),3) if events else None,new_recall=round(sum(e['new'] for e in events)/len(events),3) if events else None,rows=events),
 catalog=dict(c,changes=changes))
(a.out/'report.json').write_text(json.dumps(report,indent=1))
h,t,s=report['hand'],report['at_the_time'],report['steam_labels']
lines=['# Review-bomb detector evaluation','',f"Hand-labelled set: {h['cases']} cases ({h['bombs']} bombs). New model blind to Steam's labels.",'','| Setting | Model | TP | FP | FN | TN | Precision | Recall |','|---|---|--:|--:|--:|--:|--:|--:|']
for setting,block in (('Hindsight',h),(f"Judged at the time ({LIVE_DAYS} days in)",t)):
 for name in ('old','new'):
  m=block[name];lines.append(f"| {setting} | {'Old v2' if name=='old' else 'New v3'} | {m['tp']} | {m['fp']} | {m['fn']} | {m['tn']} | {m['precision']} | {m['recall']} |")
lines+=['',f"Steam-labelled off-topic windows: {s['events']} in {s['games']} games. Old overlaps {s['old_recall']}; new detects {s['new_detected']} and calls {s['new_recall']} bombs blind.",'',
 f"Catalog ({c['rated_low']:,} rated-low games): old adjusted {c['old_adjusted']:,} and rescued {c['old_rescued']:,} ({c['old_double_counted_steam_labels']:,} re-subtracted a window Steam had already excluded); new adjusted {c['new_adjusted']:,} ({c['new_active_bombs']:,} active bombs) and rescued {c['new_rescued']:,}; {c['new_open_banners']:,} open windows shown without adjustment; {c['steam_flagged_games']:,} games carry a Steam off-topic label.",
 '','## Hindsight','','| Game | Label | Steam flag | Old | New | Verdicts |','|---|---|---|---|---|---|']
for r in hand:
 lines.append(f"| {r['title']} ({r['appid']}) | {r['label']} {r['window']} | {'yes' if r['steam_flagged'] else ''} | {'adjust' if r['old'] else '—'} | {'adjust' if r['new'] else '—'} | {'; '.join(v['verdict']+': '+v['reason'] for v in r['verdicts']) or 'no window'} |")
lines+=['',f'## Judged at the time ({LIVE_DAYS} days into the window)','','| Game | Label | Votes so far (+/−) | Old | New | Live verdict |','|---|---|---|---|---|---|']
for r in live:
 lines.append(f"| {r['title']} ({r['appid']}) | {r['label']} {r['window']} | {r['window_votes'][0]:,}/{r['window_votes'][1]:,} | {'adjust' if r['old'] else '—'} | {'adjust' if r['new'] else '—'} | {'; '.join(v['verdict']+': '+v['reason'] for v in r['verdicts']) or 'no window'} |")
lines+=['','## Catalog games whose rescue changed','','| Game | Steam | Old | New | New verdicts |','|---|--:|--:|--:|---|']
for r in changes:
 lines.append(f"| {r['title']} ({r['appid']}) | {r['steam']}% | {r['old']}{' ✓' if r['old_rescued'] else ''} | {r['new']}{' ✓' if r['new_rescued'] else ''} | {'; '.join(r['reasons']) or 'no window'} |")
(a.out/'report.md').write_text('\n'.join(lines)+'\n');print('\n'.join(lines[:16]))
