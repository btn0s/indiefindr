-- Fix missing table-level GRANTs for anon/authenticated/service_role.
-- RLS policies are meaningless without table-level privileges.

-- rate_limits: server-side rate limiting (read + upsert)
GRANT SELECT, INSERT, UPDATE ON public.rate_limits TO anon, authenticated;

-- game_suggestions: write generated suggestions, read for display
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_suggestions TO anon, authenticated;

-- distributed_locks: ingest locking
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributed_locks TO anon, authenticated;

-- games_new: read for suggestion scoring, write for ingest
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games_new TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games_new TO service_role;

-- collections, collection_games: read for display, write for admin
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_games TO anon, authenticated;

-- trainer tables: service role writes judgments, sessions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.judgment_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.similarity_judgments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.steam_review_edges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coreview_pairs TO service_role;
