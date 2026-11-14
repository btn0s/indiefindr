-- Game-derived page colour was tried and dropped; the column was filled on the relaunch database before that.
alter table public.games drop column if exists palette;
