-- FIX FOR SUPABASE USER CREATION TRIGGER
-- Run this script in the Supabase SQL Editor to fix the "Database error creating new user" issue.

-- 1. Drop the existing trigger to remove the broken logic
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Create a robust function to handle new user insertion
-- We target 'public.users' based on your application code (not 'profiles')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    name, 
    role, 
    phone,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    -- Try to get name from metadata, fallback to part of email or empty string
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    -- Default role to USER if not provided
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER'),
    -- Handle phone if it exists in metadata, otherwise empty string (to satisfy NOT NULL)
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true, -- is_active
    NOW(), -- created_at
    NOW()  -- updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If user exists (e.g. created manually), just update the fields
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$;

-- 3. Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Grant permissions (Optional but recommended)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;

-- 5. Add helper functions for dynamic schema inspection
DROP FUNCTION IF EXISTS get_public_tables();
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT table_name::text
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
$$;

DROP FUNCTION IF EXISTS get_table_columns(TEXT);
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE(column_name text, data_type text, ordinal_position int, is_updatable text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    column_name::text, 
    data_type::text, 
    ordinal_position::int,
    is_updatable::text
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = p_table_name
  AND is_updatable = 'YES'
  ORDER BY ordinal_position;
$$;

DROP FUNCTION IF EXISTS check_table_exists(TEXT);
CREATE OR REPLACE FUNCTION check_table_exists(p_table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = p_table_name
  );
END;
$$;

DROP FUNCTION IF EXISTS add_column_to_table(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION add_column_to_table(p_table_name TEXT, p_column_name TEXT, p_column_type TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE 'ALTER TABLE ' || quote_ident(p_table_name) || ' ADD COLUMN IF NOT EXISTS ' || quote_ident(p_column_name) || ' ' || 
            CASE 
                WHEN p_column_type = 'NUMERIC' THEN 'NUMERIC' 
                WHEN p_column_type = 'BOOLEAN' THEN 'BOOLEAN' 
                ELSE 'TEXT' 
            END;
    NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
