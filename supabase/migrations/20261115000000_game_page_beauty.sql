-- Why a recommendation fits: up to three shared tags, most specific first (scripts/relaunch/rec_why.py). Null when the
-- two games share nothing specific.
alter table public.game_recs add column if not exists why text[];
