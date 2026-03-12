-- Add temp_child_data column to inspections and approvals
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS temp_child_data JSONB;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS temp_child_data JSONB;

-- Create the trigger function
CREATE OR REPLACE FUNCTION process_child_data_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    target_table_name TEXT;
    child_records JSONB;
    modified_records JSONB;
    insert_query TEXT;
BEGIN
    -- Check if temp_child_data is provided
    IF NEW.temp_child_data IS NOT NULL THEN
        -- Iterate over each key (target table name) in the JSONB object
        FOR target_table_name, child_records IN SELECT * FROM jsonb_each(NEW.temp_child_data)
        LOOP
            -- Inject the parent ID into each record and remove temporary fields
            SELECT jsonb_agg(
                jsonb_set(
                    record - '_is_pending' - '_target_table' - 'id' - 'ROWID',
                    '{parent_id}',
                    to_jsonb(NEW.id)
                )
            )
            INTO modified_records
            FROM jsonb_array_elements(child_records) AS record;

            IF modified_records IS NOT NULL THEN
                -- Construct dynamic INSERT statement using jsonb_populate_recordset
                -- This is the dynamic equivalent of jsonb_to_recordset
                insert_query := format('INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::%I, $1)', target_table_name, target_table_name);
                EXECUTE insert_query USING modified_records;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error processing child data: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS process_child_data_inspections_trigger ON inspections;
CREATE TRIGGER process_child_data_inspections_trigger
AFTER INSERT ON inspections
FOR EACH ROW
EXECUTE FUNCTION process_child_data_on_insert();

DROP TRIGGER IF EXISTS process_child_data_approvals_trigger ON approvals;
CREATE TRIGGER process_child_data_approvals_trigger
AFTER INSERT ON approvals
FOR EACH ROW
EXECUTE FUNCTION process_child_data_on_insert();

-- Optional: Also trigger on UPDATE if needed
DROP TRIGGER IF EXISTS process_child_data_inspections_update_trigger ON inspections;
CREATE TRIGGER process_child_data_inspections_update_trigger
AFTER UPDATE OF temp_child_data ON inspections
FOR EACH ROW
WHEN (NEW.temp_child_data IS DISTINCT FROM OLD.temp_child_data)
EXECUTE FUNCTION process_child_data_on_insert();

DROP TRIGGER IF EXISTS process_child_data_approvals_update_trigger ON approvals;
CREATE TRIGGER process_child_data_approvals_update_trigger
AFTER UPDATE OF temp_child_data ON approvals
FOR EACH ROW
WHEN (NEW.temp_child_data IS DISTINCT FROM OLD.temp_child_data)
EXECUTE FUNCTION process_child_data_on_insert();
