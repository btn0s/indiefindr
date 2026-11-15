alter table public.games
 add column if not exists is_early_access boolean not null default false,
 add column if not exists upcoming_rank integer check (upcoming_rank > 0);
create index if not exists games_upcoming on public.games(upcoming_rank) where upcoming_rank is not null;
