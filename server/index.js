// index.js — Main server entry point

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./src/config/config');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');

// Initialize database (creates tables if first run)
require('./src/db/database');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: config.cors.clientUrl,
  credentials: true,
}));

app.use(express.json());

if (config.server.isDevelopment) {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',    require('./src/routes/auth.routes'));
app.use('/api/users',   require('./src/routes/user.routes'));
app.use('/api/streams', require('./src/routes/stream.routes'));

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(errorHandler);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.cors.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Wire up all socket events
const setupSocket = require('./src/socket/socketManager');
setupSocket(io);

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(config.server.port, () => {
  logger.info(`🚀 Server running on http://localhost:${config.server.port}`);
  logger.info(`📡 Socket.IO ready`);
  logger.info(`🌍 Environment: ${config.server.nodeEnv}`);
});