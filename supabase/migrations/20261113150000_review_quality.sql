-- Offline-only review quality. Steam's public label remains unchanged.
alter table public.games
 add column clean_score double precision check (clean_score between 0 and 100),
 add column bomb_windows jsonb not null default '[]'::jsonb check (jsonb_typeof(bomb_windows) = 'array'),
 add column checked_at timestamptz;
