// database.js
// Sets up SQLite connection and runs schema on first start.
// Usage: const db = require('./db/database');
//        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(1);

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const logger = require('../utils/logger');

// Make sure the data directory exists before trying to create the DB file
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open (or create) the SQLite database file
const db = new Database(config.db.path);

// Enable WAL mode: much better performance for concurrent reads/writes
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints (SQLite disables them by default!)
db.pragma('foreign_keys = ON');

// Read and run the schema SQL to create tables if they don't exist yet
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// ─── Runtime migrations ──────────────────────────────────────────────────────
// SQLite doesn't support IF NOT EXISTS on ALTER TABLE, so we try/catch each.
const migrations = [
  `ALTER TABLE streams ADD COLUMN description TEXT DEFAULT ''`,
  `ALTER TABLE streams ADD COLUMN category TEXT DEFAULT 'Just Chatting'`,
  `ALTER TABLE streams ADD COLUMN peak_viewer_count INTEGER DEFAULT 0`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) { /* column already exists — safe to ignore */ }
}

logger.info(`Database connected: ${config.db.path}`);

module.exports = db;