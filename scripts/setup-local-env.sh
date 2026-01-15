#!/bin/bash
# Generate .env.local from Supabase local instance
# This script extracts Supabase credentials and writes them to .env.local

set -e

echo "Fetching Supabase local environment variables..."

# Get full status output
STATUS_OUTPUT=$(supabase status 2>&1)

if echo "$STATUS_OUTPUT" | grep -q "not running\|No such container"; then
  echo "Error: Supabase is not running. Run 'pnpm supabase:start' first."
  exit 1
fi

# Extract values using regex patterns
# Project URL format: │ Project URL    │ http://127.0.0.1:54321              │
# API is always on port 54321 for local Supabase
SUPABASE_URL="http://127.0.0.1:54321"

# Publishable key format: │ Publishable │ sb_publishable_... │
SUPABASE_ANON_KEY=$(echo "$STATUS_OUTPUT" | grep -oE 'sb_publishable_[A-Za-z0-9_-]+' | head -1)

# Secret key format: │ Secret      │ sb_secret_... │
SUPABASE_SERVICE_KEY=$(echo "$STATUS_OUTPUT" | grep -oE 'sb_secret_[A-Za-z0-9_-]+' | head -1)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: Could not extract Supabase credentials from status output"
  echo ""
  echo "Status output:"
  echo "$STATUS_OUTPUT"
  exit 1
fi

# Read existing .env.local to preserve other vars (like OPENAI_API_KEY, etc.)
ENV_FILE=".env.local"
TEMP_FILE=$(mktemp)

# If .env.local exists, preserve non-Supabase vars
if [ -f "$ENV_FILE" ]; then
  grep -v "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_FILE" | \
  grep -v "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" | \
  grep -v "^SUPABASE_SERVICE_ROLE_KEY=" | \
  grep -v "^# Supabase" > "$TEMP_FILE" 2>/dev/null || true
fi

# Write Supabase vars
cat >> "$TEMP_FILE" << EOF

# Supabase Local Development (auto-generated)
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
EOF

mv "$TEMP_FILE" "$ENV_FILE"

echo "✓ Updated .env.local with Supabase local credentials"
echo ""
echo "Values:"
echo "  NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:0:20}..."
echo "  SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY:0:20}..."
