#!/usr/bin/env node

/**
 * Database migration runner for Quantis.
 *
 * Reads .sql files from the migrations/ directory (sorted alphabetically)
 * and executes them sequentially against the configured PostgreSQL database.
 *
 * Environment variables (loaded from .env via dotenv):
 *   DB_HOST     - database host (default: localhost)
 *   DB_PORT     - database port (default: 5432)
 *   DB_NAME     - database name (required)
 *   DB_USER     - database user (required)
 *   DB_PASSWORD - database password (required)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env from project root
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename FROM _migrations ORDER BY id');
  return new Set(result.rows.map((r) => r.filename));
}

async function applyMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf-8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };

  if (!dbConfig.database || !dbConfig.user || !dbConfig.password) {
    console.error('Error: DB_NAME, DB_USER, and DB_PASSWORD environment variables are required.');
    process.exit(1);
  }

  const client = new Client(dbConfig);

  try {
    console.log(`Connecting to database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}...`);
    await client.connect();
    console.log('Connected.\n');

    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = await getMigrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('All migrations are already applied. Nothing to do.');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):\n`);

    for (const filename of pending) {
      process.stdout.write(`  Applying ${filename} ... `);
      const start = Date.now();
      await applyMigration(client, filename);
      const duration = Date.now() - start;
      console.log(`done (${duration}ms)`);
    }

    console.log('\nAll migrations applied successfully.');
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
