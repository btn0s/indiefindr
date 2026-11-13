#!/bin/bash
# Sync environment variables from Vercel to GitHub secrets
# This automates the setup by pulling existing Vercel env vars

set -e

echo "🔄 Syncing secrets from Vercel to GitHub"
echo ""

# Check dependencies
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI is not installed. Install it:"
    echo "   brew install gh"
    exit 1
fi

if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Install it:"
    echo "   npm install -g vercel"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "🔑 Authenticating with GitHub..."
    gh auth login
fi

echo "🔑 Authenticating with Vercel..."
vercel whoami > /dev/null 2>&1 || vercel login

echo ""
echo "📦 Pulling environment variables from Vercel..."

# Pull production env vars to a temp file
TEMP_ENV=$(mktemp)
vercel env pull "$TEMP_ENV" --environment=production --yes 2>/dev/null || {
    echo "❌ Failed to pull Vercel env vars. Make sure you're in a linked Vercel project."
    echo "   Run: vercel link"
    exit 1
}

# Extract specific env vars we need for GitHub
echo "📋 Extracting Supabase credentials..."
SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$TEMP_ENV" | cut -d'=' -f2- | tr -d '"' || echo "")
SUPABASE_ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$TEMP_ENV" | cut -d'=' -f2- | tr -d '"' || echo "")
SUPABASE_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$TEMP_ENV" | cut -d'=' -f2- | tr -d '"' || echo "")

# Extract project ref from URL (e.g., https://abc123.supabase.co -> abc123)
if [ -n "$SUPABASE_URL" ]; then
    SUPABASE_PROJECT_REF=$(echo "$SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')
fi

# Clean up temp file
rm "$TEMP_ENV"

# Validate we got the Supabase vars
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Could not find Supabase credentials in Vercel environment variables"
    echo ""
    echo "Missing:"
    [ -z "$SUPABASE_URL" ] && echo "  - NEXT_PUBLIC_SUPABASE_URL"
    [ -z "$SUPABASE_ANON_KEY" ] && echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    [ -z "$SUPABASE_SERVICE_KEY" ] && echo "  - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "Add these to Vercel first, then re-run this script."
    exit 1
fi

echo "✓ Found Supabase credentials"
echo ""

# Get Vercel project details
echo "📋 Getting Vercel project details..."
VERCEL_PROJECT_INFO=$(vercel project ls --json 2>/dev/null | head -1)
VERCEL_PROJECT_ID=$(echo "$VERCEL_PROJECT_INFO" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
VERCEL_ORG_ID=$(echo "$VERCEL_PROJECT_INFO" | grep -o '"accountId":"[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$VERCEL_PROJECT_ID" ] || [ -z "$VERCEL_ORG_ID" ]; then
    echo "⚠️  Could not auto-detect Vercel project details"
    read -p "   Enter VERCEL_ORG_ID: " VERCEL_ORG_ID
    read -p "   Enter VERCEL_PROJECT_ID: " VERCEL_PROJECT_ID
fi

echo "✓ Project ID: $VERCEL_PROJECT_ID"
echo "✓ Org ID: $VERCEL_ORG_ID"
echo ""

# Get Supabase Access Token (can't pull from Vercel, must be entered)
echo "🔑 Supabase Access Token"
echo "   Get from: https://supabase.com/dashboard/account/tokens"
read -sp "   Enter SUPABASE_ACCESS_TOKEN: " SUPABASE_ACCESS_TOKEN
echo ""
echo ""

# Get Vercel Token
echo "🔑 Vercel Token"
echo "   Get from: https://vercel.com/account/tokens"
read -sp "   Enter VERCEL_TOKEN: " VERCEL_TOKEN
echo ""
echo ""

# Set all secrets
echo "📤 Setting GitHub secrets..."
echo ""

gh secret set SUPABASE_ACCESS_TOKEN <<< "$SUPABASE_ACCESS_TOKEN"
echo "✓ SUPABASE_ACCESS_TOKEN"

gh secret set SUPABASE_PROJECT_REF <<< "$SUPABASE_PROJECT_REF"
echo "✓ SUPABASE_PROJECT_REF ($SUPABASE_PROJECT_REF)"

gh secret set SUPABASE_ANON_KEY <<< "$SUPABASE_ANON_KEY"
echo "✓ SUPABASE_ANON_KEY"

gh secret set SUPABASE_SERVICE_ROLE_KEY <<< "$SUPABASE_SERVICE_KEY"
echo "✓ SUPABASE_SERVICE_ROLE_KEY"

gh secret set VERCEL_TOKEN <<< "$VERCEL_TOKEN"
echo "✓ VERCEL_TOKEN"

gh secret set VERCEL_ORG_ID <<< "$VERCEL_ORG_ID"
echo "✓ VERCEL_ORG_ID ($VERCEL_ORG_ID)"

gh secret set VERCEL_PROJECT_ID <<< "$VERCEL_PROJECT_ID"
echo "✓ VERCEL_PROJECT_ID ($VERCEL_PROJECT_ID)"

echo ""
echo "✅ All secrets synced successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Enable Supabase Branching:"
echo "   → Go to https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/settings/branching"
echo "   → Enable Branching"
echo "   → Connect your GitHub repository"
echo "   → Set 'main' as production branch"
echo "   → Enable automatic branching for PRs"
echo ""
echo "2. Re-run the GitHub Actions workflow in your PR"
echo ""
