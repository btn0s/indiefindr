-- Safe seed data for preview branches and local development
-- This file is automatically run when:
-- 1. Creating a new Supabase preview branch (via Branching)
-- 2. Running `supabase db reset` locally
--
-- IMPORTANT: This seed does NOT include:
-- - Storage objects or metadata
-- - Runtime data (rate_limits, distributed_locks, etc.)
--
-- NOTE: Seed user is included for local development convenience only
-- Email: test@example.com
-- Password: password123

-- Sample games for testing (3 popular indie games)
-- Note: Videos will be fetched from Steam when games are accessed
INSERT INTO games_new (appid, screenshots, videos, title, header_image, short_description, long_description, raw)
VALUES
  (
    413150,
    '["https://cdn.akamai.steamstatic.com/steam/apps/413150/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Stardew Valley',
    'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg',
    'You''ve inherited your grandfather''s old farm plot in Stardew Valley',
    'You''ve inherited your grandfather''s old farm plot in Stardew Valley. Armed with hand-me-down tools and a few coins, you set out to begin your new life. Can you learn to live off the land and turn these overgrown fields into a thriving home?',
    '{"type": "game", "name": "Stardew Valley", "steam_appid": 413150}'::jsonb
  ),
  (
    367520,
    '["https://cdn.akamai.steamstatic.com/steam/apps/367520/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Hollow Knight',
    'https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg',
    'Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom',
    'Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom of insects and heroes. Explore twisting caverns, battle tainted creatures and befriend bizarre bugs, all in a classic, hand-drawn 2D style.',
    '{"type": "game", "name": "Hollow Knight", "steam_appid": 367520}'::jsonb
  ),
  (
    646570,
    '["https://cdn.akamai.steamstatic.com/steam/apps/646570/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Slay the Spire',
    'https://cdn.akamai.steamstatic.com/steam/apps/646570/header.jpg',
    'We fused card games and roguelikes together to make the best single player deckbuilder we could',
    'We fused card games and roguelikes together to make the best single player deckbuilder we could. Craft a unique deck, encounter bizarre creatures, discover relics of immense power, and Slay the Spire!',
    '{"type": "game", "name": "Slay the Spire", "steam_appid": 646570}'::jsonb
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

-- Link games to collection (only games that exist in seed)
INSERT INTO collection_games (collection_id, appid, position)
VALUES
  ('00000000-0000-0000-0000-000000000001', 413150, 0),
  ('00000000-0000-0000-0000-000000000001', 367520, 1),
  ('00000000-0000-0000-0000-000000000001', 646570, 2)
ON CONFLICT (collection_id, appid) DO NOTHING;

-- Seed user for local development
-- Email: test@example.com
-- Password: password123
-- This user will automatically get a default "Saved" list via the trigger
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
