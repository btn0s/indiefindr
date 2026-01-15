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
5. **GitHub Actions** syncs the preview branch credentials to Vercel as branch-scoped environment variables
6. When the PR closes, Supabase automatically deletes the preview branch

### Setup (One-Time)

1. **Enable Supabase Branching**:
   - Go to your Supabase project dashboard
   - Navigate to **Settings → Branching**
   - Enable **Branching** feature
   - Connect your GitHub repository
   - Set `main` as the **production branch**
   - Enable **Automatic branching for PRs**

2. **Add GitHub Secrets**:
   - `SUPABASE_ACCESS_TOKEN` - Get from Supabase Dashboard → Account → Access Tokens
   - `SUPABASE_PROJECT_REF` - Your production project reference ID (found in project settings)
   - `SUPABASE_ANON_KEY` - Your production project's anon key (from API settings)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your production project's service role key (from API settings)
   - `VERCEL_TOKEN` - Get from Vercel Dashboard → Settings → Tokens
   - `VERCEL_ORG_ID` - Your Vercel organization ID
   - `VERCEL_PROJECT_ID` - Your Vercel project ID

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
4. GitHub Actions waits for branch creation, then sets Vercel env vars
5. Vercel deploys the preview with the correct Supabase credentials
6. Test your changes against the isolated preview database
7. When PR closes, preview branch and Vercel env vars are cleaned up

## Production Migrations

### Option A: Automatic (Recommended)

Supabase GitHub Integration automatically applies migrations to production when you merge to `main`. This is the simplest approach and requires no additional setup.

### Option B: Explicit CI Deployment

If you prefer explicit control, you can add a GitHub Action that runs `supabase db push` on merges to `main`. See `.github/workflows/supabase-prod-migrations.yml` (if created).

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

### Preview branch not found

If GitHub Actions reports "branch not found":
- Wait a few minutes - Supabase Branching may take time to create the branch
- Check Supabase Dashboard → Branching to see if the branch was created
- Verify your `SUPABASE_PROJECT_REF` secret is correct

### Vercel preview uses wrong database

- Ensure branch-scoped env vars are set (check Vercel Dashboard → Settings → Environment Variables)
- Verify the branch name matches between GitHub and Vercel
- Check GitHub Actions logs for credential sync errors

### Local Supabase won't start

- Ensure Docker Desktop is running
- Check if ports 54321-54327 are available
- Try `supabase stop` then `supabase start` again
- Check Docker logs: `docker ps` and `docker logs <container-id>`
