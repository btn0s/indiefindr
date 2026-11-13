"""Settled medium popularity tilt, applied to indie model-ordered candidates."""
POPULARITY_CAPS = ((50_000, 2), (10_000, 4))
MODEL_VERSION = 'lambdarank_merged-indie-full-v2-tilt-m2-4'

def select_targets(candidates, review_counts, count=10):
    selected = []
    used = [0] * len(POPULARITY_CAPS)
    for target in candidates:
        reviews = review_counts[target]
        if target in selected or any(reviews >= threshold and used[i] >= cap
                                     for i, (threshold, cap) in enumerate(POPULARITY_CAPS)):
            continue
        selected.append(target)
        for i, (threshold, _) in enumerate(POPULARITY_CAPS):
            used[i] += reviews >= threshold
        if len(selected) == count:
            return selected
    raise ValueError(f'Only {len(selected)} candidates satisfy popularity caps; need {count}')
