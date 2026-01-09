# Database Migration History

## Timeline

### Initial Schema (20250101000000)

Created `games` and `ingest_jobs` tables with embedding-based approach.

### Games New Table (20250106000000)

Created `games_new` table for AI-based recommendation system.

### Legacy Table Cleanup (20260105000000 & 20260109000003)

Dropped old `games` and `ingest_jobs` tables after migration complete.

Note: Two migration files exist for the drops to handle different 
deployment scenarios (local vs. production) during the transition period.

## Current State

Production schema uses:
- `games_new` - Main games table
- `game_suggestions` - Recommendations table
- `games_new_home` - Materialized view for homepage
