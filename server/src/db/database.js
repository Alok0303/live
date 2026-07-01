const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const logger = require('../utils/logger');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Bring back better-sqlite3!
const Database = require('better-sqlite3');
const db = new Database(config.db.path);

// Native synchronous pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

const migrations = [
  `ALTER TABLE streams ADD COLUMN description TEXT DEFAULT ''`,
  `ALTER TABLE streams ADD COLUMN category TEXT DEFAULT 'Just Chatting'`,
  `ALTER TABLE streams ADD COLUMN peak_viewer_count INTEGER DEFAULT 0`,
  `ALTER TABLE streams ADD COLUMN is_paid INTEGER DEFAULT 0`,
  `ALTER TABLE streams ADD COLUMN price INTEGER DEFAULT 0`,
  `ALTER TABLE streams ADD COLUMN scheduled_start_time DATETIME DEFAULT NULL`,
  `ALTER TABLE streams ADD COLUMN recording_url TEXT DEFAULT NULL`,
];

for (const sql of migrations) {
  try { 
    db.exec(sql); 
  } catch (err) { 
    if (!err.message.includes("duplicate column name")) {
      throw err;
    }
  }
}

logger.info(`Database connected: ${config.db.path}`);

module.exports = db;