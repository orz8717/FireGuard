-- SQL Script for Supabase SQL Editor
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
