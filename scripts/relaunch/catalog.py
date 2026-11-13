"""The settled catalog eligibility rule, shared by imports and offline ranking."""
import re
# Major publishers and the studios they own. A game is not indie if any publisher OR developer is on this list.
MAJOR_OWNERS = {
 'electronic arts','ea','ubisoft','activision','activision blizzard',
 'take two interactive','rockstar games','2k','2k games','warner bros',
 'warner bros interactive entertainment','warner bros interactive','warner bros games',
 'sony interactive entertainment','playstation','playstation publishing',
 'microsoft','xbox game studios','nintendo','bethesda','bethesda softworks',
 'zenimax','square enix','capcom','bandai namco','bandai namco entertainment',
 'sega','konami','namco','thq','thq nordic','focus home interactive',
 'focus entertainment','paradox interactive','wargaming','riot games',
 'blizzard entertainment','valve','epic games',
 'netease games','tencent games','krafton','nexon','ncsoft','snail games usa','snail games',
 # Epic
 'psyonix','psyonix llc','mediatonic',
 # Microsoft
 'mojang','mojang studios','bethesda game studios','id software','arkane studios','machinegames',
 'obsidian entertainment','inxile entertainment','ninja theory','compulsion games','playground games',
 'double fine productions','the coalition','343 industries','rare ltd','undead labs','world s edge',
 # Activision
 'infinity ward','treyarch','raven software','sledgehammer games','high moon studios','beenox',
 # EA
 'respawn entertainment','dice','ea dice','criterion games','bioware','motive studio','maxis','codemasters',
 # Sony
 'bungie','insomniac games','naughty dog','sucker punch productions','guerrilla','santa monica studio',
 # Take-Two
 'gearbox software','firaxis games','hangar 13','visual concepts',
 # Warner
 'rocksteady studios','netherrealm studios','monolith productions','tt games','avalanche software',
}
MAJOR_PREFIXES = ('ubisoft ','electronic arts ','sega ','square enix ','bandai namco ','warner bros ','2k ','xbox ','playstation ','activision ','blizzard ','capcom ','konami ')
def normalize_publisher(name):
 return re.sub(r'[^a-z0-9]+',' ',name.lower()).strip()
def is_major(name):
 name=normalize_publisher(name)
 return name in MAJOR_OWNERS or name.startswith(MAJOR_PREFIXES)
def is_indie(row, tags):
 if any(is_major(name) for name in (row.get('publishers') or [])+(row.get('developers') or [])):return False
 genres=[genre.get('description','') if isinstance(genre,dict) else genre for genre in (row.get('genres') or [])]
 return any(str(genre).casefold()=='indie' for genre in genres) or any(tag.get('tagid')==492 or str(tag.get('name','')).casefold()=='indie' for tag in tags)
