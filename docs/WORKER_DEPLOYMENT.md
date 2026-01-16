# Suggestions Worker Deployment

The suggestions worker is a long-running Node.js process that polls the database for queued suggestion jobs and processes them. Since Vercel doesn't support long-running processes, the worker needs to be deployed separately.

## Deployment Options

### Option 1: Railway (Recommended)

Railway is the simplest option for deploying Node.js workers.

1. **Create a Railway project**:
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Configure the service**:
   - Railway will auto-detect the `railway.json` config
   - Set environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `OPENAI_API_KEY`
     - `PERPLEXITY_API_KEY`

3. **Deploy**:
   - Railway will automatically deploy on every push to your main branch
   - The worker will start automatically and restart on failure

**Cost**: ~$5/month for the hobby plan (includes $5 credit)

### Option 2: Render

Render offers a free tier for background workers.

1. **Create a Render service**:
   - Go to [render.com](https://render.com)
   - Click "New +" → "Background Worker"
   - Connect your GitHub repository

2. **Configure**:
   - Build Command: `pnpm install`
   - Start Command: `pnpm worker:suggestions`
   - Environment: `Node`
   - Add environment variables (same as Railway)

3. **Deploy**:
   - Render will deploy automatically on push to main
   - The worker will auto-restart on failure

**Cost**: Free tier available (with limitations), $7/month for standard

### Option 3: Fly.io

Fly.io is great for long-running processes with global distribution.

1. **Install Fly CLI**: `curl -L https://fly.io/install.sh | sh`

2. **Create app**:
   ```bash
   fly launch --no-deploy
   ```

3. **Create `fly.toml`**:
   ```toml
   app = "your-worker-name"
   primary_region = "iad"

   [build]

   [env]
     NODE_ENV = "production"

   [[services]]
     internal_port = 8080
     protocol = "tcp"
   ```

4. **Set secrets**:
   ```bash
   fly secrets set NEXT_PUBLIC_SUPABASE_URL=...
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=...
   fly secrets set OPENAI_API_KEY=...
   fly secrets set PERPLEXITY_API_KEY=...
   ```

5. **Deploy**:
   ```bash
   fly deploy
   ```

**Cost**: Free tier includes 3 shared-cpu VMs, ~$2-5/month for dedicated

### Option 4: Supabase Edge Functions + pg_cron (Event-Driven)

Convert the worker to an event-driven architecture using Supabase's built-in features.

**Pros**: No separate service to manage, scales automatically
**Cons**: Requires refactoring the worker to use webhooks/triggers instead of polling

This would involve:
1. Creating a Supabase Edge Function that processes a single job
2. Using `pg_cron` to periodically call the Edge Function
3. Or using database triggers to call the Edge Function when jobs are created

## Recommended: Railway

For simplicity and reliability, **Railway** is recommended because:
- Zero-config deployment (uses `railway.json`)
- Automatic restarts on failure
- Simple environment variable management
- Good free tier
- Integrates well with GitHub

## Environment Variables

All deployment options require these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)
- `OPENAI_API_KEY` - OpenAI API key for AI suggestions
- `PERPLEXITY_API_KEY` - Perplexity API key for web search

## Monitoring

After deployment, monitor the worker:

1. **Check logs**: Railway/Render/Fly all provide log streaming
2. **Database monitoring**: Check `suggestion_jobs` table for failed jobs
3. **Set up alerts**: Configure alerts for worker downtime or high failure rates

## Local Testing

Before deploying, test the worker locally:

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export OPENAI_API_KEY=...
export PERPLEXITY_API_KEY=...

# Run worker
pnpm worker:suggestions
```
