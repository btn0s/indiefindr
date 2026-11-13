create table game_suggestions (
  id uuid primary key default gen_random_uuid(),
  source_appid integer not null references games_new(appid) on delete cascade,
  suggested_appid integer not null,
  reason text not null,
  created_at timestamptz default now(),
  
  unique(source_appid, suggested_appid)
);

create index idx_game_suggestions_source on game_suggestions(source_appid);
create index idx_game_suggestions_suggested on game_suggestions(suggested_appid);
