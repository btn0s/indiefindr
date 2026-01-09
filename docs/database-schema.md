# Database Schema

## Table Naming: Why `games_new`?

The main table is called `games_new` due to project evolution:

1. Initial schema used `games` table with embedding-based recommendations
2. Migration to AI-based recommendations required schema changes
3. Created `games_new` table with updated structure
4. Legacy `games` table was dropped in migration 20260105000000

The "new" suffix remains to avoid breaking existing deployments. 
A future major version may rename it to just `games`.

## Current Schema

### games_new

Primary table storing Steam game metadata and AI-generated suggestions.

**Key columns:**
- `appid` (primary key) - Steam App ID
- `title`, `short_description`, `long_description` - Game text content
- `developers`, `publishers` - Creator information
- `screenshots`, `videos` - Media URLs
- `suggested_game_appids` - JSONB array of AI-generated suggestions

### game_suggestions

Stores individual game-to-game recommendations with explanations.

**Key columns:**
- `source_appid` - Game being recommended from
- `suggested_appid` - Game being recommended
- `reason` - AI-generated explanation of similarity
