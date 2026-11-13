#!/bin/bash
# Setup GitHub secrets for Supabase preview branches
# This script uses the gh CLI to set repository secrets

set -e

echo "🔐 Setting up GitHub secrets for Supabase preview branches"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI is not installed. Install it first:"
    echo "   brew install gh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "🔑 Not authenticated with GitHub. Running gh auth login..."
    gh auth login
fi

echo "📋 We need to collect some credentials..."
echo ""

# Get Supabase credentials
echo "1. Supabase Access Token"
echo "   Get from: https://supabase.com/dashboard/account/tokens"
read -sp "   Enter SUPABASE_ACCESS_TOKEN: " SUPABASE_ACCESS_TOKEN
echo ""
echo ""

echo "2. Supabase Project Reference"
echo "   Found in your project URL (e.g., 'ndiwjugonecjegtsdjhv' from https://ndiwjugonecjegtsdjhv.supabase.co)"
read -p "   Enter SUPABASE_PROJECT_REF: " SUPABASE_PROJECT_REF
echo ""

echo "3. Supabase Production Keys"
echo "   Get from: Supabase Dashboard → Project Settings → API"
read -sp "   Enter SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
echo ""
read -sp "   Enter SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
echo ""
echo ""

echo "4. Vercel Credentials"
echo "   Get from: https://vercel.com/account/tokens"
read -sp "   Enter VERCEL_TOKEN: " VERCEL_TOKEN
echo ""
echo ""

echo "5. Vercel Project Info"
echo "   Get from: Vercel Dashboard → Project Settings → General"
read -p "   Enter VERCEL_ORG_ID: " VERCEL_ORG_ID
read -p "   Enter VERCEL_PROJECT_ID: " VERCEL_PROJECT_ID
echo ""

# Set secrets using gh CLI
echo "📤 Setting GitHub secrets..."
echo ""

echo "$SUPABASE_ACCESS_TOKEN" | gh secret set SUPABASE_ACCESS_TOKEN
echo "✓ SUPABASE_ACCESS_TOKEN"

echo "$SUPABASE_PROJECT_REF" | gh secret set SUPABASE_PROJECT_REF
echo "✓ SUPABASE_PROJECT_REF"

echo "$SUPABASE_ANON_KEY" | gh secret set SUPABASE_ANON_KEY
echo "✓ SUPABASE_ANON_KEY"

echo "$SUPABASE_SERVICE_ROLE_KEY" | gh secret set SUPABASE_SERVICE_ROLE_KEY
echo "✓ SUPABASE_SERVICE_ROLE_KEY"

echo "$VERCEL_TOKEN" | gh secret set VERCEL_TOKEN
echo "✓ VERCEL_TOKEN"

echo "$VERCEL_ORG_ID" | gh secret set VERCEL_ORG_ID
echo "✓ VERCEL_ORG_ID"

echo "$VERCEL_PROJECT_ID" | gh secret set VERCEL_PROJECT_ID
echo "✓ VERCEL_PROJECT_ID"

echo ""
echo "✅ All secrets set successfully!"
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
