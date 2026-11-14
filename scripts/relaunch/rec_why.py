"""Why a recommendation fits: up to three Steam tags the two games share, most specific first.

Specificity is how rare a tag is among indie games. Tags carried by a quarter or more of indies (Indie,
Singleplayer, Casual, Action, Adventure, 2D, 3D) say nothing, and neither do store, quality or content-warning tags.
Computed with the slates (prepare.py) and stored on game_recs.why, so the game page only prints it.
"""
GENERIC_SHARE = 0.25
LIMIT = 3
NOT_TRAITS = {
 'Indie', 'Singleplayer', 'Early Access', 'Free to Play', 'Great Soundtrack', 'Replay Value', 'Controller',
 'Sexual Content', 'Nudity', 'Hentai', 'Violent', 'Gore', 'Mature', 'NSFW', 'Tutorial', 'Short', 'Classic',
 'Cult Classic', 'Masterpiece', 'Addictive', 'Beautiful', 'Great for Beginners', 'Family Friendly', 'Moddable',
 'Remake', 'Sequel', 'Kickstarter', 'Crowdfunded', 'Well-Written', 'Episodic', 'Steam Machine', 'TrackIR',
 'Instrumental Music', 'Soundtrack', 'Software', 'Utilities', 'Free', 'In-App Purchases', 'Benchmark',
}


def tag_specificity(games, tag_names):
    """Share of indie games carrying each descriptive tag; generic and non-trait tags are left out."""
    indies = [g for g in games if g['is_indie']]
    counts = {}
    for game in indies:
        for tag in game['tag_ids']:
            counts[tag] = counts.get(tag, 0) + 1
    return {tag: count / len(indies) for tag, count in counts.items()
            if count / len(indies) < GENERIC_SHARE and tag_names.get(tag) and tag_names[tag] not in NOT_TRAITS}


def display(name):
    """Tags read as a lowercase phrase; acronyms and mixed-case words (RPG, LGBTQ+, PvP, 2D) keep their case."""
    return ' '.join('-'.join(part.lower() if part.lstrip("'")[1:] == part.lstrip("'")[1:].lower() else part
                             for part in word.split('-')) for word in name.strip().split(' '))


def why(source_tags, target_tags, specificity, tag_names):
    """Display names of up to three shared descriptive tags, rarest first; None when nothing specific is shared.
    A tag that repeats one already picked (building and base building, roguelike and action roguelike) is skipped."""
    target = set(target_tags)
    picked = []
    for tag in sorted((t for t in dict.fromkeys(source_tags) if t in target and t in specificity), key=specificity.get):
        words = set(display(tag_names[tag]).replace('-', ' ').split())
        if not any(words <= other or other <= words for _, other in picked):
            picked.append((display(tag_names[tag]), words))
        if len(picked) == LIMIT:
            break
    return [name for name, _ in picked] or None
