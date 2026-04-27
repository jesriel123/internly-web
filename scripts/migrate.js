#!/usr/bin/env node
/**
 * Database Migration Runner
 * Applies pending migrations to Supabase database
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

/**
 * Get list of applied migrations from database
 */
async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: true });

  if (error) {
    console.error('❌ Error fetching applied migrations:', error.message);
    return [];
  }

  return data.map(row => row.version);
}

/**
 * Get list of migration files from filesystem
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn('⚠️  Migrations directory not found');
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

/**
 * Apply a single migration
 */
async function applyMigration(filename) {
  const version = filename.replace('.sql', '');
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`📝 Applying migration: ${filename}`);

  try {
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      throw error;
    }

    // Record the migration
    const { error: insertError } = await supabase
      .from('schema_migrations')
      .insert({
        version,
        name: filename.replace('.sql', '').replace(/^\d+_/, ''),
        applied_at: new Date().toISOString(),
      });

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ Applied: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to apply ${filename}:`, error.message);
    return false;
  }
}

/**
 * Main migration runner
 */
async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  const appliedMigrations = await getAppliedMigrations();
  const migrationFiles = getMigrationFiles();

  if (migrationFiles.length === 0) {
    console.log('ℹ️  No migration files found');
    return;
  }

  const pendingMigrations = migrationFiles.filter(file => {
    const version = file.replace('.sql', '');
    return !appliedMigrations.includes(version);
  });

  if (pendingMigrations.length === 0) {
    console.log('✅ All migrations are up to date');
    return;
  }

  console.log(`📋 Found ${pendingMigrations.length} pending migration(s)\n`);

  for (const migration of pendingMigrations) {
    const success = await applyMigration(migration);
    if (!success) {
      console.error('\n❌ Migration failed. Stopping.');
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations completed successfully');
}

// Run migrations
runMigrations().catch(error => {
  console.error('❌ Migration error:', error);
  process.exit(1);
});
