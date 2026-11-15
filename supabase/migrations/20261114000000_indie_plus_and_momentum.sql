alter table public.games
 add column if not exists indie_plus boolean not null default false,
 add column if not exists momentum double precision check (momentum > 0);
create index if not exists games_rising on public.games(momentum desc) where momentum is not null;
