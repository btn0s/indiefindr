-- Fresh project only. Historical migrations are preserved in archive/.
create table public.tags (id integer primary key, name text not null);
create table public.games (
 appid integer primary key, slug text not null unique, title text not null,
 short_description text, header_image text, release_date date,
 screenshots text[] not null default '{}', trailers jsonb not null default '[]'::jsonb,
 developers text[] not null default '{}', publishers text[] not null default '{}',
 genres text[] not null default '{}', price_cents integer, is_free boolean not null default false,
 steam_type text, review_count integer not null default 0,
 review_positive_pct integer check (review_positive_pct between 0 and 100),
 tag_ids integer[] not null default '{}', is_indie boolean not null default false,
 search_vector tsvector generated always as (to_tsvector('english', title)) stored,
 updated_at timestamptz not null default now()
);
create index games_search on public.games using gin(search_vector);
create index games_home on public.games(is_indie, review_count desc, appid);
create index games_popular on public.games(review_count desc, appid);
create index games_indie_release on public.games(is_indie, release_date desc, review_count desc);
create index games_indie_rating on public.games(is_indie, review_positive_pct desc, review_count desc);
create index games_developers on public.games using gin(developers);
create table public.game_recs (
 appid integer references public.games on delete cascade,
 rank integer check (rank between 1 and 10),
 rec_appid integer not null references public.games on delete cascade,
 source text check (source in ('llm','model')), model_version text not null,
 primary key(appid,source,rank), unique(appid,source,rec_appid), check(appid <> rec_appid)
);
create table public.events (
 id bigint generated always as identity primary key, ts timestamptz not null default now(),
 kind text not null check(kind in ('impression','click_card','click_steam','click_ad','click_affiliate')),
 page_appid integer, target_appid integer, position integer check(position between 0 and 100),
 session_id uuid not null, referrer text check(length(referrer) <= 2048)
);
create index events_ts on public.events(ts);
alter table public.games enable row level security;
alter table public.tags enable row level security;
alter table public.game_recs enable row level security;
alter table public.events enable row level security;
create policy games_read on public.games for select to anon,authenticated using(true);
create policy tags_read on public.tags for select to anon,authenticated using(true);
create policy recs_read on public.game_recs for select to anon,authenticated using(true);
grant select on public.games,public.tags,public.game_recs to anon,authenticated;
revoke all on public.events from anon,authenticated;
create function public.search_games(search_query text, max_results integer default 12)
returns table(appid integer,title text,header_image text)
language sql stable set search_path = public as $$
 select appid,title,header_image from games
 where search_vector @@ websearch_to_tsquery('english',search_query)
 order by ts_rank(search_vector,websearch_to_tsquery('english',search_query)) desc,appid
 limit least(greatest(max_results,1),50)
$$;
