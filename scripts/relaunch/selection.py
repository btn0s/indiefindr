"""Settled medium popularity tilt, applied to indie model-ordered candidates."""
SLATE_SIZE = 24
CANDIDATE_LIMIT = 200
POPULARITY_CAPS = ((50_000, 5), (10_000, 10))
MODEL_VERSION = 'lambdarank_merged-indie-full-v3-24-tilt-m5-10'

def select_targets(candidates, review_counts, count=SLATE_SIZE):
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
    return selected
