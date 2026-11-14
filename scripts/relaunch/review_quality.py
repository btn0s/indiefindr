"""Offline review-spike detection. Raw Steam histograms remain on disk.

Steam sends chart buckets at UTC midnight; its Pacific display dates are retained
alongside the raw epoch boundaries so the date convention is explicit.
"""
from datetime import datetime, timezone
import calendar
from statistics import median
from zoneinfo import ZoneInfo

DAY = 86400
PACIFIC = ZoneInfo('America/Los_Angeles')
VERSION = 'steam-review-spikes-v2-negative-dominant'


def rated_low(score, count):
    # Steam does not assign a sentiment label below ten reviews.
    return count >= 10 and score is not None and score < 70


def eligible(game):
    if game.get('review_count', 0) < 10 or game.get('review_positive_pct') is None:
        return True
    if game['review_positive_pct'] >= 70:
        return True
    windows = game.get('bomb_windows') or []
    return game.get('clean_score') is not None and game['clean_score'] >= 70 and bool(windows) and all(w.get('down', 0) > w.get('up', 0) for w in windows)


def votes(row):
    return int(row.get('recommendations_up', 0)), int(row.get('recommendations_down', 0))


def histogram_buckets(payload):
    """Non-overlapping vote periods: daily buckets where available; never count their weekly parents twice."""
    if payload.get('success') != 1 or not isinstance(payload.get('results'), dict):
        raise ValueError('Steam histogram unavailable')
    data = payload['results']
    daily = sorted(data.get('recent') or [], key=lambda r: r['date'])
    weekly = sorted(data.get('rollups') or [], key=lambda r: r['date'])
    resolution = data.get('rollup_type') or 'week'
    if resolution not in ('week', 'month'):
        raise ValueError('Unsupported Steam histogram resolution')
    def bucket(row, duration):
        up, down = votes(row)
        if min(up, down) < 0:
            raise ValueError('Negative review counts')
        return dict(start=int(row['date']), end=int(row['date']) + duration, up=up, down=down, resolution='day' if duration == DAY else resolution)
    buckets = [bucket(r, DAY) for r in daily]
    daily_start = min((r['date'] for r in daily), default=None)
    # A boundary week may overlap only part of recent. Subtract those daily
    # counts to retain the uncovered prefix, without double counting either side.
    for row in weekly:
        stamp = datetime.fromtimestamp(row['date'], timezone.utc)
        days = calendar.monthrange(stamp.year, stamp.month)[1] if resolution == 'month' else 7
        week = bucket(row, days * DAY)
        overlap = [r for r in daily if week['start'] <= r['date'] < week['end']]
        if not overlap:
            buckets.append(week)
        elif daily_start is not None and week['start'] < daily_start:
            up = week['up'] - sum(votes(r)[0] for r in overlap)
            down = week['down'] - sum(votes(r)[1] for r in overlap)
            if min(up, down) < 0:
                raise ValueError('Inconsistent overlapping histogram buckets')
            buckets.append(dict(start=week['start'], end=daily_start, up=up, down=down, resolution=resolution))
    buckets.sort(key=lambda r: r['start'])
    if any(a['end'] > b['start'] for a, b in zip(buckets, buckets[1:])):
        raise ValueError('Overlapping histogram periods')
    return buckets, daily


def analyze(payload, default_score):
    """Compare daily votes with the median daily baseline (including zero days).

    Rollup periods scale the daily baseline by their actual day count.
    Only negative-majority merged windows qualify; exclude both polarities. No detected spike means the
    Steam default stays authoritative; empty/incomplete data cannot rescue a game.
    """
    buckets, daily = histogram_buckets(payload)
    # The daily data is the game's observed daily baseline. Weekly rates supply
    # it only if the endpoint has no daily series at all.
    baseline = median([votes(r)[1] for r in daily]) if daily else median(
        [r['down'] / ((r['end'] - r['start']) / DAY) for r in buckets]) if buckets else 0
    flagged = []
    for b in buckets:
        days = (b['end'] - b['start']) / DAY
        if b['down'] >= 50 and b['down'] >= 10 * baseline * days:
            flagged.append(b)
    windows = []
    for b in flagged:
        if windows and windows[-1]['end_ts'] == b['start']:
            w = windows[-1];w['end_ts'] = b['end'];w['up'] += b['up'];w['down'] += b['down'];w['resolution'] = w['resolution'] if w['resolution'] == b['resolution'] else 'mixed'
        else:
            windows.append(dict(start_ts=b['start'], end_ts=b['end'], up=b['up'], down=b['down'], resolution=b['resolution']))
    windows = [w for w in windows if w['down'] > w['up']]
    for w in windows:
        w['start'] = datetime.fromtimestamp(w['start_ts'], PACIFIC).date().isoformat()
        w['end'] = datetime.fromtimestamp(w['end_ts'] - DAY, PACIFIC).date().isoformat()
        w['timezone'] = 'America/Los_Angeles'
    excluded_up = sum(w['up'] for w in windows);excluded_down = sum(w['down'] for w in windows)
    total_up = sum(b['up'] for b in buckets);total_down = sum(b['down'] for b in buckets)
    remaining_up = total_up - excluded_up;remaining_down = total_down - excluded_down
    remaining = remaining_up + remaining_down
    score = 100 * remaining_up / remaining if windows and remaining >= 10 else default_score
    return dict(clean_score=score, bomb_windows=windows, median_daily_down=baseline,
                remaining_up=remaining_up, remaining_down=remaining_down,
                total_up=total_up, total_down=total_down, detector_version=VERSION)


# Rising: review velocity over the last two weeks against the game's own earlier pace.
TREND_DAYS = 14
BASELINE_DAYS = 60
TREND_MIN_REVIEWS = 30
TREND_MIN_POSITIVE = 80
TREND_MAX_AGE_DAYS = 365
TREND_SMOOTHING = 20
TREND_MIN_MOMENTUM = 1.5


def momentum(payload, score, now):
    """Momentum = (reviews in the last 14 complete days + k) / (reviews expected at the prior pace + k).

    The prior pace comes from the 60 days before the window, or from first review if younger;
    under a week of history counts as a launch (expected 0). The first histogram bucket with votes
    dates the game, so an early-access game's 1.0 release does not make it look new. Returns None
    when the game is too old, too quiet, below the quality floor (lifetime and recent), or not rising
    (under 1.5x its own prior pace; launches clear this by volume alone).
    """
    buckets, daily = histogram_buckets(payload)
    end = int(now.timestamp()) // DAY * DAY
    start = end - TREND_DAYS * DAY
    first = next((b['start'] for b in buckets if b['up'] + b['down']), None)
    # Daily data must cover the window, or the game's whole life (a launch inside the window).
    daily_start = min((r['date'] for r in daily), default=None)
    if first is None or daily_start is None or daily_start > max(start, first) or first < end - TREND_MAX_AGE_DAYS * DAY:
        return None
    def count(lo, hi, polarity=('up', 'down')):
        return sum(b[k] for b in buckets for k in polarity
                   if b['end'] > lo and b['start'] < hi) if hi > lo else 0
    def prorated(lo, hi):
        return sum((b['up'] + b['down']) * (min(b['end'], hi) - max(b['start'], lo)) / (b['end'] - b['start'])
                   for b in buckets if b['end'] > lo and b['start'] < hi)
    recent = count(start, end);recent_up = count(start, end, ('up',))
    base_start = max(first, start - BASELINE_DAYS * DAY);base_days = (start - base_start) / DAY
    expected = prorated(base_start, start) / base_days * TREND_DAYS if base_days >= 7 else 0
    if recent < TREND_MIN_REVIEWS or score is None or score < TREND_MIN_POSITIVE or 100 * recent_up < TREND_MIN_POSITIVE * recent:
        return None
    lift = (recent + TREND_SMOOTHING) / (expected + TREND_SMOOTHING)
    if lift < TREND_MIN_MOMENTUM:
        return None
    return dict(momentum=round(lift, 3), recent_reviews=recent,
                expected_reviews=round(expected, 1), first_review=datetime.fromtimestamp(first, timezone.utc).date().isoformat())
