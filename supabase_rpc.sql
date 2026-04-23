-- SQL Script for Supabase SQL Editor
-- Run ALL functions below in Supabase → SQL Editor → New Query → Run

-- Returns columns with data type and position for a specific table
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE(
  column_name text,
  data_type   text,
  ordinal_position integer,
  is_updatable text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::text,
    c.data_type::text,
    c.ordinal_position::integer,
    c.is_updatable::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name   = p_table_name
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;

-- Returns all public tables list
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type   = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_public_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_tables() TO service_role;

-- Returns full schema metadata (all tables + columns + types)
CREATE OR REPLACE FUNCTION get_schema_metadata()
RETURNS TABLE(
  table_name  text,
  column_name text,
  data_type   text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.table_name::text,
    c.column_name::text,
    c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_schema_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION get_schema_metadata() TO anon;
GRANT EXECUTE ON FUNCTION get_schema_metadata() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- This RPC returns the schema definition (tables and columns) for the public schema.

CREATE OR REPLACE FUNCTION get_schema_definition()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_object_agg(table_name, columns)
  INTO result
  FROM (
    SELECT table_name, json_agg(column_name) AS columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
  ) AS schema_info;
  
  -- Return empty object if no tables found instead of NULL
  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_schema_definition() TO authenticated;
GRANT EXECUTE ON FUNCTION get_schema_definition() TO anon;
GRANT EXECUTE ON FUNCTION get_schema_definition() TO service_role;
