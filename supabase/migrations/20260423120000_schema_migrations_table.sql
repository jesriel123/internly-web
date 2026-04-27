-- ============================================================
-- Migration: Schema Migrations Tracking Table
-- Description: Creates a table to track applied migrations
-- Date: 2026-04-23
-- ============================================================

-- Create schema_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(64)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);

-- Add comment
COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations';

-- Insert this migration as the first entry
INSERT INTO schema_migrations (version, name, checksum)
VALUES ('20260423120000', 'schema_migrations_table', 'initial')
ON CONFLICT (version) DO NOTHING;
