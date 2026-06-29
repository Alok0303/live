// config.js
// Single source of truth for all environment variables.
// Import this file anywhere you need config — never use process.env directly elsewhere.

require('dotenv').config();

const config = {
  // Server settings
  server: {
    port: parseInt(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
  },

  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Database settings
  db: {
    path: process.env.DB_PATH || './data/livestream.db',
  },

  // CORS settings
  cors: {
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  },
};

// Warn if using fallback JWT secret in production
if (!process.env.JWT_SECRET && config.server.nodeEnv === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

module.exports = config;