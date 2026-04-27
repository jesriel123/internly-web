# Database Migrations

This directory contains versioned database migrations for the Internly system.

## Migration Naming Convention

Migrations follow the format: `YYYYMMDDHHMMSS_description.sql`

Example: `20260423120000_initial_schema.sql`

## Running Migrations

### Using Supabase CLI (Recommended)
```bash
# Apply all pending migrations
supabase db push

# Create a new migration
supabase migration new description_here
```

### Manual Application
1. Open Supabase SQL Editor
2. Copy migration content
3. Execute in order (oldest to newest)

## Migration Order

Migrations must be applied in chronological order. The system tracks applied migrations in the `schema_migrations` table.

## Rollback

Each migration should include a corresponding rollback in comments or a separate `_rollback.sql` file.
