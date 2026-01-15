# Supabase Development & Branching Setup

This document describes the Supabase development workflow, preview branch setup, and production deployment process.

## Local Development

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Docker Desktop running (required for local Supabase stack)

### Quick Start

```bash
# Start local Supabase stack
pnpm supabase:start

# Reset database (applies all migrations + seed data)
pnpm supabase:reset

# Check status
pnpm supabase:status

# Stop local stack
pnpm supabase:stop

# Generate TypeScript types from database schema
pnpm supabase:types
```

### Local Environment Variables

The `pnpm dev` script automatically syncs Supabase credentials to `.env.local`. You don't need to manually edit environment variables for Supabase.

**Automatic sync**: When you run `pnpm dev`, it:
1. Starts Supabase (if not already running)
2. Extracts credentials from `supabase status`
3. Writes them to `.env.local` (preserving any existing vars like `OPENAI_API_KEY`)

**Manual sync**: If you need to update `.env.local` manually:
```bash
pnpm supabase:env
```

**View credentials**: Check current Supabase credentials:
```bash
pnpm supabase:status
```

The local Supabase instance uses:
- `NEXT_PUBLIC_SUPABASE_URL` - `http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Auto-generated anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-generated service role key

### Creating Migrations

```bash
# Create a new migration
supabase migration new migration_name

# Edit the generated SQL file in supabase/migrations/
# Then test locally:
pnpm supabase:reset
```

## Preview Branches (Per-PR Databases)

### How It Works

1. **Supabase Branching** automatically creates a preview branch when you open a PR
2. The preview branch gets its own isolated database, API URL, and credentials
3. Migrations from `supabase/migrations/` are automatically applied
4. `supabase/seed.sql` is automatically run on branch creation
5. **Supabase's Vercel Integration** automatically syncs preview branch credentials to Vercel
6. When the PR closes, Supabase automatically deletes the preview branch

### Setup (One-Time)

1. **Enable Supabase GitHub Integration**:
   - Go to your Supabase project dashboard
   - Navigate to **Settings → Integrations → GitHub**
   - Connect your GitHub repository
   - Set `main` as the **production branch**
   - Enable **Automatic branching for PRs**
   - Configure Supabase directory (default: `./` or `./supabase`)
   - Enable "Deploy to production on push including PR merges"

2. **Enable Supabase Vercel Integration**:
   - Navigate to **Settings → Integrations → Vercel**
   - Connect your Vercel account
   - Select which Vercel project to sync with
   - Enable sync for **Production** and **Preview** environments
   - Supabase will automatically keep environment variables up to date

### Preview Branch URL Format

Preview branches use this URL format:
```
https://<project-ref>-<branch-name>.supabase.co
```

For example, if your project ref is `abc123` and your branch is `feature-x`:
```
https://abc123-feature-x.supabase.co
```

### Workflow

1. Create a feature branch and push to GitHub
2. Open a Pull Request
3. Supabase creates the preview branch automatically
4. Supabase's Vercel Integration syncs preview branch credentials to Vercel
5. Vercel deploys the preview with the correct Supabase credentials
6. Test your changes against the isolated preview database
7. When PR closes, Supabase automatically deletes the preview branch

## Production Migrations

Supabase's GitHub Integration automatically applies migrations to production when you merge to `main`. 

The integration watches your `supabase/migrations/` directory and applies any new migrations to your production database when changes are pushed to the production branch.

This happens automatically and doesn't require any additional CI/CD setup.

## Seed Data

The `supabase/seed.sql` file contains minimal, non-sensitive seed data suitable for:
- Preview branch creation (runs automatically)
- Local development (runs on `supabase db reset`)

**Important**: The seed file does NOT include:
- Auth users or sessions
- Storage objects
- Runtime data (rate limits, locks, etc.)

For local development with richer data, you can create `supabase/seed.local.sql` and run it manually after reset.

## Troubleshooting

### Preview branch not created

If preview branches aren't being created:
- Check Supabase Dashboard → Integrations → GitHub to verify connection
- Ensure "Automatic branching for PRs" is enabled
- Verify the Supabase directory path is correct (usually `./` or `./supabase`)

### Vercel preview uses wrong database

- Check Supabase Dashboard → Integrations → Vercel to verify connection
- Ensure Preview environment sync is enabled
- Verify the correct Vercel project is connected
- Wait a few minutes for Supabase to sync credentials after preview branch creation

### Local Supabase won't start

- Ensure Docker Desktop is running
- Check if ports 54321-54327 are available
- Try `supabase stop` then `supabase start` again
- Check Docker logs: `docker ps` and `docker logs <container-id>`
