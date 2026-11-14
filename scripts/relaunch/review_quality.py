"""Review-bomb detection: find sentiment breaks, then tell bombs from declines.

The headline score (Steam's `summary_filtered`, what the site shows) is the
authority. It already leaves out the periods Steam itself marked as off-topic
review activity, so those are reported but never subtracted again. Every
adjustment is computed in that same population (GetAppReviews counts for the
window with Steam's default filters), so clean_score compares like with like.

Pipeline per game:
1. `buckets`: the histogram as non-overlapping periods (daily where Steam has
   them, weekly/monthly before that).
2. `candidates`: periods whose negative rate jumps far above a robust trailing
   baseline (rolling median + MAD of the previous ~6 months) *and* whose
   sentiment breaks from that baseline. Launch spikes, sales and free weekends
   raise volume without breaking sentiment, so they do not qualify.
3. `classify`: each merged window gets a verdict, a reason and its numbers.
   - steam_flagged: Steam labelled it; already excluded from the headline.
   - bomb: sentiment afterwards returned most of the way to where it was before
     (recovery >= 0.6). Excluded from clean_score.
   - decline: sentiment afterwards stayed down (recovery < 0.6). Players really
     changed their minds; never adjusted.
   - unresolved: too few reviews before or after to judge the shape. Promoted
     to bomb only on strong off-topic evidence from the reviews themselves.
   Positive bursts go through the same test and are reported, never subtracted
   (see `POSITIVE`).
"""
from datetime import datetime, timezone
import calendar,re
from collections import Counter
from statistics import median
from zoneinfo import ZoneInfo

DAY = 86400
PACIFIC = ZoneInfo('America/Los_Angeles')
VERSION = 'steam-review-events-v3'

MIN_VOTES = 30          # a window needs this many votes of its polarity
DAILY_GAP = 2           # quiet days allowed inside an ongoing daily window
SURGE = 4               # rate must exceed baseline by this factor ...
SURGE_MAD = 4           # ... and by this many robust deviations
SENTIMENT_BREAK = .25   # share of the window's polarity above the baseline share
BASELINE_DAYS = 183     # trailing reference period
JUDGE_MIN = 20          # reviews needed before and after to judge recovery
POST_GUARD = 28 * DAY   # skip the decay tail right after the window
POST_DAYS = 730         # how far after the window recovery is measured
POST_MIN_DAYS = 60      # ... and at least this much history must exist after the guard
RECOVERED = .6          # fraction of the drop that must come back for a bomb ...
SETTLED = 10            # ... and sentiment afterwards within this many points of before
# Positive bursts (support campaigns, giveaways, launches of a sequel) are found
# by the same test and reported as `positive_windows`, but never subtracted:
# the site only uses the score to keep sub-70% games out of recommendations, so
# removing them could only lower a score that is already below the gate, and a
# positive burst is far more often real players (a fix, a free weekend) than a
# brigade. Steam's own off-topic labels already remove flagged ones of either sign.
POSITIVE = 'reported'


def rated_low(score, count):
    # Steam does not assign a sentiment label below ten reviews.
    return count >= 10 and score is not None and score < 70


def eligible(game):
    if game.get('review_count', 0) < 10 or game.get('review_positive_pct') is None:
        return True
    if game['review_positive_pct'] >= 70:
        return True
    # Rescued only by a window that was actually subtracted (counter-reviews can leave
    # one with up >= down). Open windows still being judged carry adjusted=False;
    # rows from before v3 have no flag and only stored negative-majority windows.
    windows = [w for w in game.get('bomb_windows') or [] if isinstance(w, dict) and w.get('adjusted', w.get('down', 0) > w.get('up', 0))]
    return game.get('clean_score') is not None and game['clean_score'] >= 70 and bool(windows)


def buckets(payload):
    """Non-overlapping periods. Daily buckets win; weekly/monthly parents keep only their uncovered prefix."""
    if payload.get('success') != 1 or not isinstance(payload.get('results'), dict):
        raise ValueError('Steam histogram unavailable')
    data = payload['results']
    daily = sorted(data.get('recent') or [], key=lambda r: r['date'])
    rollups = sorted(data.get('rollups') or [], key=lambda r: r['date'])
    resolution = data.get('rollup_type') or 'week'
    if resolution not in ('week', 'month'):
        raise ValueError('Unsupported Steam histogram resolution')
    def votes(row):
        return int(row.get('recommendations_up', 0)), int(row.get('recommendations_down', 0))
    def bucket(row, duration):
        up, down = votes(row)
        if min(up, down) < 0:
            raise ValueError('Negative review counts')
        return dict(start=int(row['date']), end=int(row['date']) + duration, up=up, down=down, resolution='day' if duration == DAY else resolution)
    out = [bucket(r, DAY) for r in daily]
    daily_start = min((r['date'] for r in daily), default=None)
    for row in rollups:
        stamp = datetime.fromtimestamp(row['date'], timezone.utc)
        days = calendar.monthrange(stamp.year, stamp.month)[1] if resolution == 'month' else 7
        period = bucket(row, days * DAY)
        overlap = [r for r in daily if period['start'] <= r['date'] < period['end']]
        if not overlap:
            out.append(period)
        elif daily_start is not None and period['start'] < daily_start:
            up = period['up'] - sum(votes(r)[0] for r in overlap)
            down = period['down'] - sum(votes(r)[1] for r in overlap)
            if min(up, down) < 0:
                raise ValueError('Inconsistent overlapping histogram buckets')
            out.append(dict(start=period['start'], end=daily_start, up=up, down=down, resolution=resolution))
    out.sort(key=lambda r: r['start'])
    if any(a['end'] > b['start'] for a, b in zip(out, out[1:])):
        raise ValueError('Overlapping histogram periods')
    return out


def steam_events(payload):
    """Steam's own off-topic labels as half-open [start, end) spans; end_date is the last day."""
    return [dict(start_ts=int(e['start_date']), end_ts=int(e['end_date']) + DAY) for e in payload.get('past_events') or []
            if e.get('start_date') and e.get('end_date')]


def _tally(periods):
    up = sum(p['up'] for p in periods); down = sum(p['down'] for p in periods)
    return up, down


def _share(up, down):
    return up / (up + down) if up + down else None


def _baseline(bs, i):
    """Trailing ~6 months of rates; launch periods with no history look forward instead."""
    start = bs[i]['start']
    ref = [b for b in bs[:i] if b['start'] >= start - BASELINE_DAYS * DAY]
    if sum(b['up'] + b['down'] for b in ref) < JUDGE_MIN:
        ref = [b for b in bs[i + 1:] if b['start'] < bs[i]['end'] + BASELINE_DAYS * DAY]
    return ref


def candidates(bs):
    """Merged windows whose votes of one polarity surge and break from baseline sentiment."""
    flagged = []
    for i, b in enumerate(bs):
        ref = _baseline(bs, i)
        if not ref:
            continue
        days = (b['end'] - b['start']) / DAY
        up_base, down_base = _tally(ref)
        for polarity, key, other in (('negative', 'down', 'up'), ('positive', 'up', 'down')):
            votes = b[key]
            if votes < MIN_VOTES:
                continue
            rates = [r[key] / ((r['end'] - r['start']) / DAY) for r in ref]
            base = median(rates); mad = 1.4826 * median(abs(x - base) for x in rates)
            rate = votes / days
            share = votes / (b['up'] + b['down'])
            base_share = (down_base if key == 'down' else up_base) / (up_base + down_base) if up_base + down_base else .5
            # No majority rule: bombs draw counter-reviews (Borderlands 2's Steam-flagged
            # April 2019 month was 46% negative against a 10% baseline).
            if rate >= SURGE * base and rate >= base + SURGE_MAD * mad and share >= base_share + SENTIMENT_BREAK:
                flagged.append(dict(b, polarity=polarity, base_rate=base, base_share=base_share, index=i))
    windows = []
    for b in flagged:
        last = windows[-1] if windows else None
        # Adjacent periods merge; an ongoing bomb's daily buckets may have up to two quiet days between.
        gap = bs[last['index'] + 1:b['index']] if last else []
        if last and last['polarity'] == b['polarity'] and (last['end_ts'] == b['start'] or (len(gap) <= DAILY_GAP and all(g['resolution'] == 'day' for g in gap + [b]))):
            up, down = _tally(gap)
            last['end_ts'] = b['end']; last['up'] += b['up'] + up; last['down'] += b['down'] + down; last['index'] = b['index']
            last['resolution'] = last['resolution'] if last['resolution'] == b['resolution'] else 'mixed'
        else:
            windows.append(dict(start_ts=b['start'], end_ts=b['end'], up=b['up'], down=b['down'], resolution=b['resolution'],
                                polarity=b['polarity'], base_share=round(b['base_share'], 3), index=b['index']))
    for w in windows:
        del w['index']
    return windows


def shape(bs, w):
    """Sentiment before, during and after a window, from the histogram."""
    pre = [b for b in bs if b['end'] <= w['start_ts'] and b['start'] >= w['start_ts'] - 365 * DAY]
    if sum(b['up'] + b['down'] for b in pre) < JUDGE_MIN:
        pre = [b for b in bs if b['end'] <= w['start_ts']]
    post = [b for b in bs if b['start'] >= w['end_ts'] + POST_GUARD and b['start'] < w['end_ts'] + POST_GUARD + POST_DAYS * DAY]
    (pu, pd), (au, ad) = _tally(pre), _tally(post)
    before, during, after = _share(pu, pd), _share(w['up'], w['down']), _share(au, ad)
    out = dict(before_pct=_pct(before), during_pct=_pct(during), after_pct=_pct(after), before_n=pu + pd, after_n=au + ad,
               days=round((w['end_ts'] - w['start_ts']) / DAY))
    out['days_since'] = round((bs[-1]['end'] - w['end_ts']) / DAY)
    # Open or too recent for a settled after-period: judged live, re-judged nightly.
    out['live'] = out['days_since'] * DAY < POST_GUARD + POST_MIN_DAYS * DAY
    if pu + pd >= JUDGE_MIN and au + ad >= JUDGE_MIN and not out['live']:
        sign = 1 if w['polarity'] == 'negative' else -1
        drop = sign * (before - during); moved = sign * (after - during)
        out['recovery'] = round(moved / drop, 2) if drop > 0 else 1.0
        # Points still missing versus before; negative when it ended up better.
        out['settled_gap'] = round(100 * sign * (before - after), 1)
    return out


def _pos(pct):
    return 'no reviews' if pct is None else f'{pct}% positive'


def _pct(share):
    return None if share is None else round(100 * share, 1)


WORD = re.compile(r"[^\W\d_]{4,}", re.UNICODE)
STOP = set('this that with have game games play played playing just like really dont good about from they there their what when your will would more much very even only some than then them also been were because still could into after other time make made over most which while those these where game. great best review reviews steam'.split())


def evidence(window, baseline, topics=None):
    """Per-review evidence for one window versus the year of reviews before it.

    Each sample is GetAppReviews review objects. Everything here needs no data
    from after the window, so an open bomb can be judged while it happens.
    `topics` maps texts to off-game booleans (review_topics.off_game); without
    it the off-topic shares are omitted. Returns plain numbers so every verdict
    can be read back.
    """
    if not window:
        return None
    def norm(r):
        return re.sub(r'\W+', ' ', (r.get('review') or '').lower()).strip()
    texts = [norm(r) for r in window]
    counts = Counter(t for t in texts if t)
    duplicated = sum(n for t, n in counts.items() if n > 1 and len(t) >= 3) / len(window)
    def words(rs):
        return [set(WORD.findall(norm(r))) - STOP for r in rs]
    ww, bw = words(window), words(baseline)
    df = Counter(w for s in ww for w in s); bdf = Counter(w for s in bw for w in s)
    topic, topic_share, topic_base = None, 0., 0.
    for term, n in df.most_common(40):
        share = n / len(ww); base = bdf[term] / len(bw) if bw else 0.
        if share - base > topic_share - topic_base:
            topic, topic_share, topic_base = term, share, base
    def languages(rs):
        c = Counter(r.get('language') for r in rs); n = len(rs)
        return {k: v / n for k, v in c.items()}
    lw, lb = languages(window), languages(baseline) if baseline else {}
    shift = .5 * sum(abs(lw.get(k, 0) - lb.get(k, 0)) for k in set(lw) | set(lb)) if baseline else None
    def frac(rs, test):
        return round(sum(1 for r in rs if test(r)) / len(rs), 2) if rs else None
    low_play = lambda r: (r.get('author') or {}).get('playtime_at_review', 0) < 120
    one_review = lambda r: (r.get('author') or {}).get('num_reviews', 0) <= 1
    free = lambda r: bool(r.get('received_for_free'))
    out = dict(sample=len(window), baseline_sample=len(baseline), duplicate_share=round(duplicated, 2),
               topic=topic, topic_share=round(topic_share, 2), topic_baseline_share=round(topic_base, 2),
               language_shift=None if shift is None else round(shift, 2), top_language=max(lw, key=lw.get),
               low_playtime_share=frac(window, low_play), low_playtime_baseline=frac(baseline, low_play),
               one_review_share=frac(window, one_review), one_review_baseline=frac(baseline, one_review),
               free_key_share=frac(window, free), free_key_baseline=frac(baseline, free))
    if topics:
        flags = topics([r.get('review') or '' for r in window + baseline])
        out['off_game_share'] = round(sum(flags[:len(window)]) / len(window), 2)
        out['off_game_baseline'] = round(sum(flags[len(window):]) / len(baseline), 2) if baseline else None
    return out


OUTSIDERS = .35         # language-mix shift that marks reviewers from outside the game's players


def outsiders(ev):
    """The window's reviewers came from a different language community than the game's players.

    Regional campaigns (pricing, politics, platform bans) are the commonest
    off-topic bombs Steam labels, and they can stay negative for months, so in
    hindsight this signal stands on its own, independent of recovery.
    """
    if not ev or ev['sample'] < 20 or ev['baseline_sample'] < 20 or ev['language_shift'] is None or ev['language_shift'] < OUTSIDERS:
        return None
    return f"language mix shifted {ev['language_shift']:.0%} (now mostly {ev['top_language']})"


def families(ev):
    """Evidence grouped into three independent families, each with its readable signals.

    what: the reviews are about something outside the game.
    who: the reviewers are not the game's usual players (little playtime, new
         accounts, free keys, another language community).
    coordination: copy-paste text or one word dominating the window.
    `players` is the opposite reading: established players writing about the game.
    """
    if not ev or ev['sample'] < 20 or ev['baseline_sample'] < 20:
        return None
    what, who, coordination = [], [], []
    if ev.get('off_game_share') is not None and ev['off_game_share'] >= .3 and ev['off_game_share'] >= ev['off_game_baseline'] + .2:
        what.append(f"{ev['off_game_share']:.0%} of reviews about things outside the game vs {ev['off_game_baseline']:.0%} before")
    if ev['low_playtime_share'] >= ev['low_playtime_baseline'] + .25:
        who.append(f"{ev['low_playtime_share']:.0%} under 2h played vs {ev['low_playtime_baseline']:.0%} before")
    if ev['one_review_share'] >= ev['one_review_baseline'] + .2:
        who.append(f"{ev['one_review_share']:.0%} first-ever reviews vs {ev['one_review_baseline']:.0%} before")
    if ev['free_key_share'] >= .3 and ev['free_key_share'] >= ev['free_key_baseline'] + .2:
        who.append(f"{ev['free_key_share']:.0%} free keys vs {ev['free_key_baseline']:.0%} before")
    if outsiders(ev):
        who.append(outsiders(ev))
    if ev['duplicate_share'] >= .15:
        coordination.append(f"{ev['duplicate_share']:.0%} copy-paste text")
    if ev['topic_share'] >= .35 and ev['topic_share'] >= 4 * max(ev['topic_baseline_share'], .03):
        coordination.append(f"'{ev['topic']}' in {ev['topic_share']:.0%} of reviews vs {ev['topic_baseline_share']:.0%} before")
    players = (ev.get('off_game_share') is not None and ev['off_game_share'] <= max(.15, ev['off_game_baseline'] + .1)
               and ev['low_playtime_share'] <= ev['low_playtime_baseline'] + .1 and not who and ev['duplicate_share'] < .15)
    return dict(what=what, who=who, coordination=coordination, players=players)


def _overlaps(w, events):
    return any(w['start_ts'] < e['end_ts'] and e['start_ts'] < w['end_ts'] for e in events)


def classify(w, events):
    """Verdict and plain reason for one window.

    Steam's own label settles it. With enough history after the window,
    recovery confirms a bomb or shows a decline (hindsight). While the window is
    open or too recent, the reviews themselves decide (live): strong evidence
    from at least two families is an active bomb, established players writing
    about the game is a decline, anything else stays unresolved. Each nightly
    run re-judges open windows until hindsight takes over.
    """
    s = w['shape']; fam = families(w.get('evidence'))
    when = f"{_pos(s['before_pct'])} before, {_pos(s['during_pct'])} during, {_pos(s['after_pct'])} after"
    if _overlaps(w, events):
        return 'steam_flagged', 'Steam marked this period as off-topic review activity and already leaves it out of its score'
    recovered = 'recovery' in s and s['recovery'] >= RECOVERED and s['settled_gap'] <= SETTLED
    if w['polarity'] == 'positive':
        return ('positive_bomb', f"Positive burst that faded: {when}") if recovered else ('rise', f"Lasting rise in sentiment: {when}")
    signals = [x for k in ('what', 'who', 'coordination') for x in (fam or {}).get(k, [])]
    found = ''.join(f"; {x}" for x in signals)
    if 'recovery' in s:
        if recovered:
            return 'bomb', f"Sharp break that recovered: {when}{found}"
        if outsiders(w.get('evidence')):
            return 'bomb', f"Reviews came from outside the game's usual players: {when}{found}"
        if s['recovery'] >= .4 and s['settled_gap'] <= 2 * SETTLED and fam and sum(bool(fam[k]) for k in ('what', 'who', 'coordination')) >= 2:
            return 'bomb', f"Partial recovery with off-topic, coordinated reviews: {when}{found}"
        return 'decline', f"Sentiment stayed down afterwards: {when}{found}"
    during = f"{_pos(s['before_pct'])} before, {_pos(s['during_pct'])} since {w['start']}"
    if not s['live'] or s['before_n'] < JUDGE_MIN:
        # Without a before there is no break to judge: a new game's bad launch week is not a bomb.
        return 'unresolved', f"Too few reviews to judge ({s['before_n']} before, {s['after_n']} after)"
    if fam and sum(bool(fam[k]) for k in ('what', 'who', 'coordination')) >= 2:
        return 'active_bomb', f"Review bomb in progress, adjusted on strong evidence from the reviews themselves: {'; '.join(signals)}; {during}"
    if fam and fam['players']:
        return 'decline', f"Players who know the game are turning on it, writing about the game itself: {during}" + (f"; {ev_line(w['evidence'])}")
    return 'unresolved', f"Possible review bomb in progress; the evidence is not strong enough to adjust yet{found}; {during}"


def ev_line(ev):
    return f"{ev['off_game_share']:.0%} about things outside the game, {ev['low_playtime_share']:.0%} under 2h played (vs {ev['low_playtime_baseline']:.0%} before)"


def _dates(w):
    w['start'] = datetime.fromtimestamp(w['start_ts'], PACIFIC).date().isoformat()
    w['end'] = datetime.fromtimestamp(w['end_ts'] - DAY, PACIFIC).date().isoformat()
    w['timezone'] = 'America/Los_Angeles'
    return w


def detect(payload):
    """Histogram-only phase: candidate windows with shape. Cheap; run on every candidate game."""
    return detect_buckets(buckets(payload))


def detect_buckets(bs):
    windows = candidates(bs)
    for w in windows:
        w['shape'] = shape(bs, w)
    return bs, windows


def needs_reviews(w):
    """Windows whose verdict or adjustment depends on GetAppReviews data."""
    return w['polarity'] == 'negative'


STORED = ('start', 'end', 'start_ts', 'end_ts', 'timezone', 'resolution', 'up', 'down', 'steam_up', 'steam_down', 'verdict', 'adjusted', 'reason', 'shape')
ADJUSTS = ('bomb', 'active_bomb')
HEADLINE_TOLERANCE = 2  # points between the API headline and the stored score


def analyze(payload, default_score, fetched=None, steam_labels=True, topics=None):
    """Score a game. `fetched` holds GetAppReviews data for windows that need it:

    {'headline': (up, down), 'windows': {start_ts: {'steam': (up, down), 'reviews': [...], 'baseline': [...]}}}

    'headline' and each window's 'steam' counts are in the headline's own
    population, so clean_score = headline minus adjusted windows, like for like.
    A bomb verdict without those counts cannot adjust: missing data never rescues.
    `topics` is the off-game text classifier (review_topics.off_game).
    `steam_labels=False` judges windows blind to Steam's labels (evaluation only).
    """
    events = steam_events(payload)
    result = judge(buckets(payload), events if steam_labels else [], default_score, fetched, topics)  # labels off only to evaluate against them
    result['steam_events'] = [_dates(dict(e)) for e in events]
    return result


def judge(bs, labels, default_score, fetched=None, topics=None):
    """analyze() on explicit buckets and Steam labels, e.g. a history cut off mid-window."""
    bs, windows = detect_buckets(bs)
    fetched = fetched or {}
    for w in windows:
        _dates(w)
        got = (fetched.get('windows') or {}).get(w['start_ts']) or {}
        if got.get('reviews') is not None:
            w['evidence'] = evidence(got['reviews'], got.get('baseline') or [], topics)
        if got.get('steam') is not None:
            w['steam_up'], w['steam_down'] = got['steam']
        w['verdict'], w['reason'] = classify(w, labels)
        w['adjusted'] = False
    adjusted = [w for w in windows if w['verdict'] in ADJUSTS and 'steam_up' in w]
    headline = fetched.get('headline')
    score = default_score
    # Like for like or not at all: the API headline must reproduce the stored score
    # (it is rounded, and may be a day older), or the window counts are in another population.
    mismatch = bool(headline and default_score is not None and sum(headline) and abs(100 * headline[0] / sum(headline) - default_score) > HEADLINE_TOLERANCE)
    if adjusted and headline and not mismatch:
        up = headline[0] - sum(w['steam_up'] for w in adjusted); down = headline[1] - sum(w['steam_down'] for w in adjusted)
        if up + down >= 10 and min(up, down) >= 0:
            score = 100 * up / (up + down)
            for w in adjusted:
                w['adjusted'] = True
    # Stored on every game row and read by cards, so kept lean: adjusted windows,
    # plus open ones still being judged (banner, no adjustment). review_events
    # keeps every window with its full evidence for the offline report.
    stored = [w for w in windows if w['adjusted'] or (w['verdict'] == 'unresolved' and w['shape']['live'] and w['shape']['before_n'] >= JUDGE_MIN)]
    total_up, total_down = _tally(bs)
    return dict(clean_score=score, bomb_windows=[{k: w[k] for k in STORED if k in w} for w in stored],
                positive_windows=[w for w in windows if w['polarity'] == 'positive'],
                review_events=windows,
                headline_up=headline[0] if headline else None, headline_down=headline[1] if headline else None,
                histogram_up=total_up, histogram_down=total_down,
                histogram_positive_pct=_pct(_share(total_up, total_down)), headline_mismatch=mismatch, detector_version=VERSION)


def open_windows(result):
    """Windows the next nightly run must re-judge."""
    return [w for w in result.get('bomb_windows') or [] if w.get('verdict') in ('active_bomb', 'unresolved')]


# Rising: review velocity over the last two weeks against the game's own earlier pace.
TREND_DAYS = 14
TREND_BASELINE_DAYS = 60
TREND_MIN_REVIEWS = 30
TREND_MIN_POSITIVE = 80
TREND_MAX_AGE_DAYS = 365
TREND_SMOOTHING = 20
TREND_MIN_MOMENTUM = 1.5


def momentum(payload, score, now, released=None, max_age_days=TREND_MAX_AGE_DAYS):
    """Momentum = (reviews in the last 14 complete days + k) / (reviews expected at the prior pace + k).

    The prior pace comes from the 60 days before the window, or from first review if younger;
    under a week of history counts as a launch (expected 0). Age runs from the later of the first
    review and the Steam release date (`released`, ISO), so an early-access 1.0 release counts as a
    launch event; indie+ already keeps relaunched giants off the shelf. max_age_days=None skips the age
    gate (Early Access games and upcoming games' demos trend at any age). Returns None
    when the game is too old, too quiet, below the quality floor (lifetime and recent), or not rising
    (under 1.5x its own prior pace; launches clear this by volume alone).
    """
    periods = buckets(payload)
    daily = payload['results'].get('recent') or []
    end = int(now.timestamp()) // DAY * DAY
    start = end - TREND_DAYS * DAY
    first = next((b['start'] for b in periods if b['up'] + b['down']), None)
    # Daily data must cover the window, or the game's whole life (a launch inside the window).
    daily_start = min((r['date'] for r in daily), default=None)
    launched = max(first, int(datetime.fromisoformat(released).replace(tzinfo=timezone.utc).timestamp())) if released and first is not None else first
    if first is None or daily_start is None or daily_start > max(start, first) or (max_age_days is not None and launched < end - max_age_days * DAY):
        return None
    def count(lo, hi, polarity=('up', 'down')):
        return sum(b[k] for b in periods for k in polarity
                   if b['end'] > lo and b['start'] < hi) if hi > lo else 0
    def prorated(lo, hi):
        return sum((b['up'] + b['down']) * (min(b['end'], hi) - max(b['start'], lo)) / (b['end'] - b['start'])
                   for b in periods if b['end'] > lo and b['start'] < hi)
    recent = count(start, end);recent_up = count(start, end, ('up',))
    base_start = max(first, start - TREND_BASELINE_DAYS * DAY);base_days = (start - base_start) / DAY
    expected = prorated(base_start, start) / base_days * TREND_DAYS if base_days >= 7 else 0
    if recent < TREND_MIN_REVIEWS or score is None or score < TREND_MIN_POSITIVE or 100 * recent_up < TREND_MIN_POSITIVE * recent:
        return None
    lift = (recent + TREND_SMOOTHING) / (expected + TREND_SMOOTHING)
    if lift < TREND_MIN_MOMENTUM:
        return None
    return dict(momentum=round(lift, 3), recent_reviews=recent, expected_reviews=round(expected, 1),
                first_review=datetime.fromtimestamp(first, timezone.utc).date().isoformat(), released=released)
