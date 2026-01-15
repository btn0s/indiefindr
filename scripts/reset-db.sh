#!/bin/bash
# Reset the local database, apply all migrations, and re-seed data
# This is useful when:
# - You've added new migrations
# - You've updated seed data
# - You want a fresh start

set -e

echo "🔄 Resetting local Supabase database..."
echo "   This will:"
echo "   1. Drop all data"
echo "   2. Apply all migrations"
echo "   3. Run seed.sql (including seed user)"
echo ""

# Make sure Supabase is running
if ! supabase status > /dev/null 2>&1; then
  echo "Starting Supabase..."
  supabase start
fi

# Reset database (applies migrations + seed)
supabase db reset

echo ""
echo "✓ Database reset complete!"
echo ""
echo "Seed user credentials:"
echo "  Email: test@example.com"
echo "  Password: password123"
echo ""
