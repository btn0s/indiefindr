-- Migration: Add profiles table with username support
-- 
-- Creates a profiles table linked to auth.users with:
-- - username (unique, lowercase, alphanumeric + underscore)
-- - display_name (optional, can be different from username)
-- - Automatically creates a profile when a user signs up

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
-- Users can read all profiles (needed for username lookups)
CREATE POLICY "Allow public read access to profiles" ON profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Allow users to update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Allow users to insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to create profile for new users
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger to create profile when a user signs up
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_user();

-- Function to validate username format
-- Username must be: 3-20 chars, alphanumeric + underscore, lowercase
CREATE OR REPLACE FUNCTION validate_username(username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF username IS NULL THEN
    RETURN true; -- NULL is allowed (username is optional)
  END IF;
  
  IF length(username) < 3 OR length(username) > 20 THEN
    RETURN false;
  END IF;
  
  IF username != lower(username) THEN
    RETURN false; -- Must be lowercase
  END IF;
  
  IF NOT (username ~ '^[a-z0-9_]+$') THEN
    RETURN false; -- Only alphanumeric and underscore
  END IF;
  
  RETURN true;
END;
$$;

-- Add check constraint for username format
ALTER TABLE profiles ADD CONSTRAINT username_format_check 
  CHECK (validate_username(username));
