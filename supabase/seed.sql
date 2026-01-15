-- Safe seed data for preview branches and local development
-- This file is automatically run when:
-- 1. Creating a new Supabase preview branch (via Branching)
-- 2. Running `supabase db reset` locally
--
-- IMPORTANT: This seed does NOT include:
-- - auth.users, sessions, or any auth data
-- - Storage objects or metadata
-- - Runtime data (rate_limits, distributed_locks, etc.)

-- Sample games for testing
INSERT INTO games_new (appid, screenshots, videos, title, header_image, short_description, long_description, raw)
VALUES
  (
    1091500,
    '["https://cdn.akamai.steamstatic.com/steam/apps/1091500/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Cyberpunk 2077',
    'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg',
    'An open-world, action-adventure RPG set in the megalopolis of Night City',
    'Cyberpunk 2077 is an open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and body modification.',
    '{"type": "game", "name": "Cyberpunk 2077", "steam_appid": 1091500}'::jsonb
  ),
  (
    271590,
    '["https://cdn.akamai.steamstatic.com/steam/apps/271590/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Grand Theft Auto V',
    'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',
    'Grand Theft Auto V for PC offers players the option to explore the award-winning world of Los Santos',
    'Grand Theft Auto V for PC offers players the option to explore the award-winning world of Los Santos and Blaine County in resolutions of up to 4K and beyond.',
    '{"type": "game", "name": "Grand Theft Auto V", "steam_appid": 271590}'::jsonb
  ),
  (
    730,
    '["https://cdn.akamai.steamstatic.com/steam/apps/730/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Counter-Strike 2',
    'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
    'Counter-Strike 2 is the largest technical leap forward in Counter-Strike history',
    'Counter-Strike 2 is the largest technical leap forward in Counter-Strike history, supporting new features and updates for years to come.',
    '{"type": "game", "name": "Counter-Strike 2", "steam_appid": 730}'::jsonb
  )
ON CONFLICT (appid) DO NOTHING;

-- Sample collection for testing
INSERT INTO collections (id, slug, title, description, published)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'sample-collection',
    'Sample Collection',
    'A sample collection for testing preview branches',
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- Link games to collection
INSERT INTO collection_games (collection_id, appid, position)
VALUES
  ('00000000-0000-0000-0000-000000000001', 1091500, 0),
  ('00000000-0000-0000-0000-000000000001', 271590, 1),
  ('00000000-0000-0000-0000-000000000001', 730, 2)
ON CONFLICT (collection_id, appid) DO NOTHING;
