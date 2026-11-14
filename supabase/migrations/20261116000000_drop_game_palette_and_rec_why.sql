-- Two game-page additions were tried and dropped: colour from the game (games.palette) and a line on each
-- recommendation saying what it shares with the page's game (game_recs.why). Both were added and filled on the
-- relaunch database while they were live. Dropping a column doesn't return its space; game_recs was rewritten
-- with VACUUM FULL afterwards.
alter table public.games drop column if exists palette;
alter table public.game_recs drop column if exists why;
