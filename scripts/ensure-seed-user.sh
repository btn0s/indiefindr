#!/bin/bash
# Ensure seed user exists for local development
# This script checks if the seed user exists and creates it if not

set -e

echo "Checking for seed user..."

# Check if Supabase is running
if ! supabase status > /dev/null 2>&1; then
  echo "Supabase is not running. Skipping seed user check."
  exit 0
fi

# Get database connection info
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Check if user exists
USER_EXISTS=$(docker exec supabase_db_games-graph psql -U postgres -tAc "SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'test@example.com');" 2>/dev/null || echo "false")

if [ "$USER_EXISTS" = "t" ]; then
  echo "✓ Seed user already exists"
  exit 0
fi

echo "Creating seed user (test@example.com / password123)..."

# Create seed user
docker exec supabase_db_games-graph psql -U postgres <<EOF
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
EOF

echo "✓ Seed user created"
echo "  Email: test@example.com"
echo "  Password: password123"
