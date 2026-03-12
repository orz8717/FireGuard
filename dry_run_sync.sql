-- ===============================================================
-- DRY-RUN / VERIFICATION SCRIPT
-- ===============================================================

-- 1. Setup: Create a dummy child table if it doesn't exist
CREATE TABLE IF NOT EXISTS test_child_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID,
    item_name TEXT,
    quantity INT
);

-- 2. Setup: Attach the trigger to the 'inspections' table
-- (Assuming 'inspections' uses 'id' as PK)
SELECT attach_child_sync_trigger('inspections', 'id');

-- 3. Dry-Run: Insert a parent record with bundled child data
-- This single insert should trigger the creation of 2 child records in 'test_child_table'
INSERT INTO inspections (
    serial_number, 
    type, 
    status, 
    temp_child_data
) VALUES (
    'DRY-RUN-001', 
    'ANNUAL', 
    'SUBMITTED', 
    '{
        "test_child_table": {
            "fk_column": "parent_id",
            "records": [
                {"item_name": "Test Item A", "quantity": 10},
                {"item_name": "Test Item B", "quantity": 5}
            ]
        }
    }'::jsonb
) RETURNING id;

-- 4. Verification: Check if children were inserted
SELECT * FROM test_child_table WHERE parent_id = (SELECT id FROM inspections WHERE serial_number = 'DRY-RUN-001');

-- 5. Dry-Run: Update the parent with new child data (Wipe & Replace)
UPDATE inspections 
SET temp_child_data = '{
    "test_child_table": {
        "fk_column": "parent_id",
        "records": [
            {"item_name": "Updated Item C", "quantity": 99}
        ]
    }
}'::jsonb
WHERE serial_number = 'DRY-RUN-001';

-- 6. Verification: Check if old children were deleted and new one inserted
SELECT * FROM test_child_table WHERE parent_id = (SELECT id FROM inspections WHERE serial_number = 'DRY-RUN-001');
