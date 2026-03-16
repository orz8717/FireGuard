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
                WHEN p_column_type = 'JSONB' THEN 'JSONB'
                WHEN p_column_type = 'UUID' THEN 'UUID'
                ELSE 'TEXT' 
            END;
    NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add get_triggers for schema diagnostics
CREATE OR REPLACE FUNCTION get_triggers()
RETURNS TABLE(table_name text, trigger_name text) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT event_object_table::text, trigger_name::text
  FROM information_schema.triggers
  WHERE trigger_schema = 'public';
$$;

-- 7. Atomic Child Sync Functions
CREATE OR REPLACE FUNCTION process_child_data_on_save()
RETURNS TRIGGER AS $$
DECLARE
    child_table TEXT;
    child_config JSONB;
    fk_col TEXT;
    records JSONB;
    record_item JSONB;
    pk_val TEXT;
    pk_col TEXT;
BEGIN
    pk_col := COALESCE(TG_ARGV[0], 'id');
    pk_val := (to_jsonb(NEW) ->> pk_col);
    IF pk_val IS NULL THEN RETURN NEW; END IF;
    IF NEW.temp_child_data IS NULL OR NEW.temp_child_data = '{}'::jsonb THEN RETURN NEW; END IF;

    FOR child_table, child_config IN SELECT * FROM jsonb_each(NEW.temp_child_data)
    LOOP
        fk_col := child_config ->> 'fk_column';
        records := child_config -> 'records';
        EXECUTE format('DELETE FROM %I WHERE %I = $1', child_table, fk_col) USING pk_val;
        IF records IS NOT NULL AND jsonb_array_length(records) > 0 THEN
            FOR record_item IN SELECT * FROM jsonb_array_elements(records)
            LOOP
                record_item := record_item || jsonb_build_object(fk_col, pk_val);
                EXECUTE format('INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1)', child_table, child_table) USING record_item;
            END LOOP;
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION attach_child_sync_trigger(p_table_name TEXT, p_pk_col TEXT DEFAULT 'id')
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS temp_child_data JSONB DEFAULT ''{}''::jsonb', p_table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_children_%I ON %I', p_table_name, p_table_name);
    EXECUTE format(
        'CREATE TRIGGER trg_sync_children_%I 
         AFTER INSERT OR UPDATE ON %I 
         FOR EACH ROW EXECUTE FUNCTION process_child_data_on_save(%L)',
        p_table_name, p_table_name, p_pk_col
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
