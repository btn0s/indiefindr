-- Early Access and Upcoming shelves, set nightly by prepare.py.
-- is_early_access: Steam marks the game as currently in Early Access. Such games carry momentum (any age) on the
-- Early Access shelf; released games carry it (launched within a year) on Rising.
-- upcoming_rank: 1 = most-wishlisted upcoming indie with a dated release in the next six months (scripts/relaunch/upcoming.py).
alter table public.games
 add column if not exists is_early_access boolean not null default false,
 add column if not exists upcoming_rank integer check (upcoming_rank > 0);
create index if not exists games_upcoming on public.games(upcoming_rank) where upcoming_rank is not null;
