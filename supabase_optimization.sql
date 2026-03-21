-- SQL Optimization Advice for FireGuard Supabase Database
-- Run these commands in the Supabase SQL Editor to improve hydration performance and prevent timeouts.

-- 1. Index for Inspections table
-- Speed up technician-specific and customer-specific lookups
CREATE INDEX IF NOT EXISTS idx_inspections_technician_id ON inspections(technician_id);
CREATE INDEX IF NOT EXISTS idx_inspections_customer_id ON inspections(customer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);

-- 2. Index for Certificates table
CREATE INDEX IF NOT EXISTS idx_certificates_customer_id ON certificates(customer_id);
CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON certificates(created_at DESC);

-- 3. Index for Permissions table
-- Critical for fast permission checks during hydration
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);

-- 4. Index for Dynamic Records (if using a shared table)
-- If dynamic records are stored in a single table with a target_table column
CREATE INDEX IF NOT EXISTS idx_dynamic_records_target_table ON dynamic_records(_target_table);
CREATE INDEX IF NOT EXISTS idx_dynamic_records_parent_id ON dynamic_records(parent_id);

-- 5. Audit Logs optimization
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 6. Customers table optimization
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_customer_number ON customers(customer_number);

-- 7. Analyze tables to update statistics
ANALYZE inspections;
ANALYZE customers;
ANALYZE permissions;
ANALYZE users;
