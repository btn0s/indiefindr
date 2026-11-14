-- Notoriety and trend data computed by the offline pipeline (prepare.py).
-- indie_plus: lifetime reviews at or above selection.INDIE_PLUS_REVIEWS; kept out of home discovery shelves.
-- momentum: Rising score (recent review velocity over the game's own prior pace); null unless shelf-eligible.
alter table public.games
 add column indie_plus boolean not null default false,
 add column momentum double precision check (momentum > 0);
create index games_rising on public.games(momentum desc) where momentum is not null;
