-- Safe seed data for preview branches and local development
-- This file is automatically run when:
-- 1. Creating a new Supabase preview branch (via Branching)
-- 2. Running `supabase db reset` locally
--
-- IMPORTANT: This seed does NOT include:
-- - auth.users, sessions, or any auth data
-- - Storage objects or metadata
-- - Runtime data (rate_limits, distributed_locks, etc.)

-- Sample games for testing (mix of popular and indie games)
INSERT INTO games_new (appid, screenshots, videos, title, header_image, short_description, long_description, raw)
VALUES
  -- Popular indie games
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
    291550,
    '["https://cdn.akamai.steamstatic.com/steam/apps/291550/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Brotato',
    'https://cdn.akamai.steamstatic.com/steam/apps/291550/header.jpg',
    'Brotato is a top-down arena shooter roguelite where you play a potato wielding up to 6 weapons at a time',
    'Brotato is a top-down arena shooter roguelite where you play a potato wielding up to 6 weapons at a time to fight off hordes of aliens. Choose from a variety of traits and items to create unique builds and survive until help arrives.',
    '{"type": "game", "name": "Brotato", "steam_appid": 291550}'::jsonb
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
  ),
  (
    1145360,
    '["https://cdn.akamai.steamstatic.com/steam/apps/1145360/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Hades',
    'https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg',
    'Defy the god of the dead as you hack and slash out of the Underworld',
    'Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler from the creators of Bastion, Transistor, and Pyre.',
    '{"type": "game", "name": "Hades", "steam_appid": 1145360}'::jsonb
  ),
  (
    1449850,
    '["https://cdn.akamai.steamstatic.com/steam/apps/1449850/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Yu-Gi-Oh! Master Duel',
    'https://cdn.akamai.steamstatic.com/steam/apps/1449850/header.jpg',
    'The definitive edition of the competitive card game that has been evolving for over 20 years!',
    'The definitive edition of the competitive card game that has been evolving for over 20 years! Duel at the highest level with 10,000+ cards and a rich deck of strategies.',
    '{"type": "game", "name": "Yu-Gi-Oh! Master Duel", "steam_appid": 1449850}'::jsonb
  ),
  (
    244850,
    '["https://cdn.akamai.steamstatic.com/steam/apps/244850/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Space Engineers',
    'https://cdn.akamai.steamstatic.com/steam/apps/244850/header.jpg',
    'Space Engineers is a sandbox game about engineering, construction, exploration and survival',
    'Space Engineers is a sandbox game about engineering, construction, exploration and survival in space and on planets. Players build space ships, wheeled vehicles, space stations, planetary outposts of various sizes and uses.',
    '{"type": "game", "name": "Space Engineers", "steam_appid": 244850}'::jsonb
  ),
  (
    230410,
    '["https://cdn.akamai.steamstatic.com/steam/apps/230410/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Warframe',
    'https://cdn.akamai.steamstatic.com/steam/apps/230410/header.jpg',
    'Awaken as an unstoppable warrior and battle alongside your friends',
    'Awaken as an unstoppable warrior and battle alongside your friends in this story-driven free-to-play online action game. Confront warring factions, solve mysteries, and explore a vast universe.',
    '{"type": "game", "name": "Warframe", "steam_appid": 230410}'::jsonb
  ),
  (
    105600,
    '["https://cdn.akamai.steamstatic.com/steam/apps/105600/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Terraria',
    'https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg',
    'Dig, fight, explore, build! Nothing is impossible in this action-packed adventure game',
    'Dig, fight, explore, build! Nothing is impossible in this action-packed adventure game. The world is your canvas and the ground itself is your paint.',
    '{"type": "game", "name": "Terraria", "steam_appid": 105600}'::jsonb
  ),
  (
    892970,
    '["https://cdn.akamai.steamstatic.com/steam/apps/892970/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Valheim',
    'https://cdn.akamai.steamstatic.com/steam/apps/892970/header.jpg',
    'A brutal exploration and survival game for 1-10 players, set in a procedurally-generated purgatory',
    'A brutal exploration and survival game for 1-10 players, set in a procedurally-generated purgatory inspired by viking culture. Battle, build, and conquer your way to a saga worthy of Odin''s patronage!',
    '{"type": "game", "name": "Valheim", "steam_appid": 892970}'::jsonb
  ),
  (
    1282100,
    '["https://cdn.akamai.steamstatic.com/steam/apps/1282100/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Remnant II',
    'https://cdn.akamai.steamstatic.com/steam/apps/1282100/header.jpg',
    'REMNANT II is the sequel to the best-selling game Remnant: From the Ashes',
    'REMNANT II is the sequel to the best-selling game Remnant: From the Ashes that pits survivors of humanity against new deadly creatures and god-like bosses across terrifying worlds.',
    '{"type": "game", "name": "Remnant II", "steam_appid": 1282100}'::jsonb
  ),
  (
    1245620,
    '["https://cdn.akamai.steamstatic.com/steam/apps/1245620/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'ELDEN RING',
    'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg',
    'THE NEW FANTASY ACTION RPG. Rise, Tarnished, and be guided by grace',
    'THE NEW FANTASY ACTION RPG. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.',
    '{"type": "game", "name": "ELDEN RING", "steam_appid": 1245620}'::jsonb
  ),
  (
    1203220,
    '["https://cdn.akamai.steamstatic.com/steam/apps/1203220/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'NARAKA: BLADEPOINT',
    'https://cdn.akamai.steamstatic.com/steam/apps/1203220/header.jpg',
    'NARAKA: BLADEPOINT is a 60-player action battle royale offering players insane mobility',
    'NARAKA: BLADEPOINT is a 60-player action battle royale offering players insane mobility powered by parkour and grappling hook, a vast arsenal of melee and ranged weapons, and a roster of characters with powerful abilities.',
    '{"type": "game", "name": "NARAKA: BLADEPOINT", "steam_appid": 1203220}'::jsonb
  ),
  (
    1621690,
    '["https://cdn.akamai.steamstatic.com/steam/apps/1621690/ss_1.jpg"]'::jsonb,
    '[]'::jsonb,
    'Core Keeper',
    'https://cdn.akamai.steamstatic.com/steam/apps/1621690/header.jpg',
    'Explore an endless cavern of creatures, relics and resources in a mining sandbox',
    'Explore an endless cavern of creatures, relics and resources in a mining sandbox adventure for 1-8 players. Mine, build, fight, craft and farm to unravel the mystery of the ancient Core.',
    '{"type": "game", "name": "Core Keeper", "steam_appid": 1621690}'::jsonb
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

-- Link games to collection (using appids that exist in seed)
INSERT INTO collection_games (collection_id, appid, position)
VALUES
  ('00000000-0000-0000-0000-000000000001', 413150, 0),
  ('00000000-0000-0000-0000-000000000001', 367520, 1),
  ('00000000-0000-0000-0000-000000000001', 1145360, 2)
ON CONFLICT (collection_id, appid) DO NOTHING;
