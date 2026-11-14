-- Companion apps, set nightly by prepare.py (scripts/relaunch/catalog.py companions()): non-game Steam app types
-- (DLC, demo, soundtrack, mod, video, episode) and free game-type apps whose title extends a paid same-developer
-- game's title (standalone demos and prologues). Searchable, but never on discovery shelves or recommended.
alter table public.games add column if not exists is_companion boolean not null default false;
