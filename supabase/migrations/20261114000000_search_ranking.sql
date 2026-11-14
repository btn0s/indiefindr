-- One title search for the search box, /api/search, MCP and the CLI.
-- Titles and queries share one normalization; candidates come from a trigram GIN index
-- plus full-text search, and ranking is tiered: exact, prefix, all words (or a close typo), then fuzzy.
-- Popularity and Steam score break ties inside a tier, with a slight indie boost.
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Lowercase, strip accents and ™/®/©, "&" -> "and", apostrophes dropped, other punctuation
-- (including ":" and "-" subtitle separators) becomes a space, roman numerals II–IX become
-- digits, and a leading the/a/an is ignored.
create function public.search_normalize(value text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
 select regexp_replace(
  btrim(regexp_replace(
   regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(
     regexp_replace(
      replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary,
       regexp_replace(value, '[™®©℠]', '', 'g'))), '&', ' and '),
      '[''’‘`´]', '', 'g'),
     '[][[:space:]!"#$%()*+,./:;<=>?@\\^_{|}~¡¿–—―…·•¦§¶†‡«»“”„-]+', ' ', 'g'),
    '\miii\M', '3', 'g'), '\mii\M', '2', 'g'), '\miv\M', '4', 'g'), '\mviii\M', '8', 'g'),
    '\mvii\M', '7', 'g'), '\mvi\M', '6', 'g'), '\mix\M', '9', 'g'),
   ' +', ' ', 'g')),
  '^(the|a|an) (?=.)', '')
$$;

alter table public.games add column search_title text
 generated always as (public.search_normalize(title)) stored;
create index games_search_title_trgm on public.games using gin (search_title extensions.gin_trgm_ops);

-- Same name and arguments as before, wider result: older callers that read appid/title/header_image keep working.
drop function public.search_games(text, integer);
create function public.search_games(search_query text, max_results integer default 8)
returns table(appid integer, title text, header_image text, release_date date,
 review_count integer, review_positive_pct integer)
language plpgsql stable set search_path = public, extensions
 -- Looser than 0.45 floods the recheck with unrelated titles for long queries; prefix and FTS still catch partial words.
 set pg_trgm.similarity_threshold = 0.45 as $$
declare
 q text := search_normalize(left(search_query, 200));
 words text[];
 all_words tsquery;
 stemmed tsquery;
begin
 if q is null or q = '' then return; end if;
 words := string_to_array(q, ' ');
 -- Every word must appear; the last one is still being typed, so it matches as a prefix.
 select to_tsquery('simple', string_agg(quote_literal(w) || case when i = cardinality(words) then ':*' else '' end, ' & '))
  into all_words from unnest(words) with ordinality as t(w, i);
 select to_tsquery('english', string_agg(quote_literal(w) || case when i = cardinality(words) then ':*' else '' end, ' & '))
  into stemmed from unnest(words) with ordinality as t(w, i);
 return query
 with candidates as (
  select g.*, similarity(g.search_title, q) as title_sim,
   greatest(similarity(g.search_title, q), word_similarity(q, g.search_title)) as sim
  from games g
  where g.search_title % q
   or g.search_title like replace(replace(q, '%', '\%'), '_', '\_') || '%'
   or g.search_vector @@ stemmed
   or q <% g.search_title
 ), scored as (
  select c.*,
   case when c.search_title = q then 4
    when c.search_title like replace(replace(q, '%', '\%'), '_', '\_') || '%' then 3
    -- All words present, or a close typo of the whole title ("hollow night" -> Hollow Knight).
    when to_tsvector('simple', c.search_title) @@ all_words or c.search_vector @@ stemmed or c.title_sim >= 0.5 then 2
    else 1 end as tier,
   -- Soundtracks, demos, playtests and DLC lose to the base game that shares their name.
   c.search_title ~ '\m(soundtrack|ost|demo|playtest|dlc|season pass|artbook|art book|wallpapers?|original score)\M' as extra,
   0.75 * least(ln(1 + c.review_count) / ln(1000000), 1)
    + 0.15 * coalesce(c.review_positive_pct, 50) / 100.0
    + 0.10 * c.is_indie::int as quality
  from candidates c
 )
 select s.appid, s.title, s.header_image, s.release_date, s.review_count, s.review_positive_pct
 from scored s
 order by s.tier desc, s.extra, case when s.tier <= 2 then s.sim else 0 end + 0.25 * s.quality desc, s.appid
 limit least(greatest(max_results, 1), 50);
end
$$;
grant execute on function public.search_games(text, integer) to anon, authenticated;
