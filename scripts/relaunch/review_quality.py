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


def analyze(payload, default_score):
    """Use daily buckets where available; never count their weekly parents twice.

    Compare daily votes with the median daily baseline (including zero days).
    Rollup periods scale the daily baseline by their actual day count.
    Only negative-majority merged windows qualify; exclude both polarities. No detected spike means the
    Steam default stays authoritative; empty/incomplete data cannot rescue a game.
    """
    if payload.get('success') != 1 or not isinstance(payload.get('results'), dict):
        raise ValueError('Steam histogram unavailable')
    data = payload['results']
    daily = sorted(data.get('recent') or [], key=lambda r: r['date'])
    weekly = sorted(data.get('rollups') or [], key=lambda r: r['date'])
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
