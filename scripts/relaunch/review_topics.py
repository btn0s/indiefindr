"""Is a review about the game, or about something outside it? Local, multilingual, no LLM.

Zero-shot nearest-prototype classification with a small multilingual sentence
encoder (paraphrase-multilingual-MiniLM-L12-v2, ~470 MB, CPU). Each review is
compared with short descriptions of off-game topics (store deals, publisher,
DRM, pricing and region, politics, accounts, launchers, the developer's
conduct) and on-game topics (gameplay, bugs, updates, abandonment,
monetisation inside the game, servers). Abandonment and in-game monetisation
are deliberately on-game: players leaving over them is a real decline.

The model must already be in HF_HOME (the nightly runs with HF_HUB_OFFLINE=1);
fetch it once with `python review_topics.py --download`.
"""
import sys
from sentence_transformers import SentenceTransformer

MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
MARGIN = .03  # off-game must beat on-game similarity by this much

OFF_GAME = [
    'the game became an Epic Games Store exclusive',
    'boycott the publisher, the publisher is greedy and evil',
    'the CEO and the company made a bad decision unrelated to the game',
    'the developer behaved badly on social media and lied to the community',
    'political statement, government, war, censorship in my country',
    'requires a PlayStation Network or third-party account to play',
    'not available in my country, region locked, delisted in my region',
    'the regional price was raised, unfair pricing in my currency',
    'added Denuvo DRM to the game',
    'forced to install a new launcher',
    'the new EULA and privacy policy is spyware, they collect my data',
    'the studio was bought by another company',
    'this is a review bomb, everyone downvote to protest',
    'protest against the company, not the game itself',
    'the developer was fired or the company laid off the team',
]
ON_GAME = [
    'the gameplay is fun and I enjoyed playing it',
    'the game is boring and repetitive',
    'full of bugs, crashes and glitches',
    'poor performance, low frame rate, stuttering',
    'the latest update broke the game and ruined it',
    'the servers are down and I cannot connect, matchmaking is bad',
    'the developers abandoned the game, no more updates, the team left',
    'the game is dead, there are no players anymore',
    'content and features were removed from the game',
    'the graphics were downgraded',
    'too many microtransactions, pay to win, expensive DLC',
    'too many cheaters and hackers',
    'the story, characters and world are great',
    'the controls and user interface feel bad',
    'early access with very slow progress',
    'balance changes ruined my favourite weapon or character',
]

_model = None


def _encoder():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL, device='cpu', local_files_only=True)
        _model.prototypes = [_model.encode(group, normalize_embeddings=True) for group in (OFF_GAME, ON_GAME)]
    return _model


def off_game(texts):
    """One bool per text: True when the text is about something outside the game."""
    texts = [t.strip()[:1000] for t in texts]
    if not texts:
        return []
    model = _encoder()
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=64)
    off, on = ((vectors @ p.T).max(axis=1) for p in model.prototypes)
    return [bool(t) and bool(o - n > MARGIN) for t, o, n in zip(texts, off, on)]


if __name__ == '__main__' and '--download' in sys.argv:
    SentenceTransformer(MODEL, device='cpu')
