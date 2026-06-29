// errorHandler.js
// Global error handler middleware.
// Any route can call next(err) and this catches it.

const logger = require('../utils/logger');
const config = require('../config/config');

const errorHandler = (err, req, res, next) => {
  // Log full error details on the server
  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    stack: err.stack,
    status: err.status,
  });

  // Send clean response to client
  res.status(err.status || 500).json({
    error: config.server.isDevelopment
      ? err.message           // Show real error in dev
      : 'Internal server error', // Hide details in production
  });
};

module.exports = errorHandler;