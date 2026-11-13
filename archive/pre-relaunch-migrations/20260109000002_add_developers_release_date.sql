alter table games_new add column developers text[] default '{}';
alter table games_new add column release_date text;

create index idx_games_new_developers on games_new using gin(developers);
create index idx_games_new_release_date on games_new(release_date);

update games_new
set
  developers = coalesce(
    (select array_agg(d)::text[] from jsonb_array_elements_text(raw->'developers') as d),
    '{}'
  ),
  release_date = raw->'release_date'->>'date'
where raw is not null;
