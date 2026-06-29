// logger.js
// Centralized logging using Winston.
// Usage: const logger = require('./utils/logger');
//        logger.info('Server started');
//        logger.error('Something broke', { error: err.message });

const winston = require('winston');
const config = require('../config/config');

// Custom log format: timestamp + level + message + any extra data
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Include stack trace on errors
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Print extra data (like { userId: 1 }) if it exists
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${extra}`;
  })
);

const logger = winston.createLogger({
  level: config.server.isDevelopment ? 'debug' : 'info',
  format: logFormat,
  transports: [
    // Always log to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Add colors in terminal
        logFormat
      ),
    }),
  ],
});

// In production, also write logs to files
if (!config.server.isDevelopment) {
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}

module.exports = logger;