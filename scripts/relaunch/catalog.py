"""The settled catalog eligibility rule, shared by imports and offline ranking."""
import re
MAJOR_PUBLISHERS = {
 'electronic arts','ea','ubisoft','activision','activision blizzard',
 'take two interactive','rockstar games','2k','2k games','warner bros',
 'warner bros interactive entertainment','warner bros interactive',
 'sony interactive entertainment','playstation','playstation publishing',
 'microsoft','xbox game studios','nintendo','bethesda','bethesda softworks',
 'zenimax','square enix','capcom','bandai namco','bandai namco entertainment',
 'sega','konami','namco','thq','thq nordic','focus home interactive',
 'focus entertainment','paradox interactive','wargaming','riot games',
 'blizzard entertainment','valve','epic games',
}
def normalize_publisher(name):
 return re.sub(r'[^a-z0-9]+',' ',name.lower()).strip()
def is_indie(row, tags):
 publishers=row.get('publishers') or []
 if any(normalize_publisher(name) in MAJOR_PUBLISHERS for name in publishers):return False
 genres=[genre.get('description','') if isinstance(genre,dict) else genre for genre in (row.get('genres') or [])]
 return any(str(genre).casefold()=='indie' for genre in genres) or any(tag.get('tagid')==492 or str(tag.get('name','')).casefold()=='indie' for tag in tags)
