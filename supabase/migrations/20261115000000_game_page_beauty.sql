-- Colour from the game: {src, dominant, dark, accent} from the store header, set by scripts/relaunch/palette.py.
-- The game page tints from it (src/lib/palette.ts) and keeps its neutrals when it is null or has no colours.
alter table public.games add column if not exists palette jsonb;
-- Why a recommendation fits: up to three shared tags, most specific first (scripts/relaunch/rec_why.py). Null when the
-- two games share nothing specific.
alter table public.game_recs add column if not exists why text[];
