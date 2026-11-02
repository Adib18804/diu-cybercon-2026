-- =============================================================================
-- DIU_CYBERCON 2026 — PostgreSQL Initialization
-- Runs once when the container is first created.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- For full-text search on names
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite GIN indexes

-- Create a read-only reporting user (optional — useful for analytics tools)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cybercon_readonly') THEN
    CREATE ROLE cybercon_readonly WITH LOGIN PASSWORD 'readonly_dev_only';
    GRANT CONNECT ON DATABASE cybercon_2026 TO cybercon_readonly;
    GRANT USAGE ON SCHEMA public TO cybercon_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT ON TABLES TO cybercon_readonly;
  END IF;
END
$$;

-- Log the initialization
DO $$
BEGIN
  RAISE NOTICE 'DIU_CYBERCON 2026 database initialized successfully.';
END
$$;
