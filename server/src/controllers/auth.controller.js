// auth.controller.js
// Handles HTTP layer for auth routes.
// Each function: validate input → call service → send response

const authService = require('../services/auth.service');
const logger = require('../utils/logger');

const authController = {

  // POST /api/auth/register
  async register(req, res, next) {
    try {
      const { username, email, password } = req.body;

      // Basic input validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email and password are required' });
      }
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 3–20 characters' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      // Simple email format check
      if (!email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      const { user, token } = await authService.register({ username, email, password });

      logger.info(`New user registered: ${username}`);
      res.status(201).json({ user, token });

    } catch (err) {
      next(err); // Pass to global error handler
    }
  },

  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { user, token } = await authService.login({ email, password });

      logger.info(`User logged in: ${user.username}`);
      res.json({ user, token });

    } catch (err) {
      next(err);
    }
  },

  // GET /api/auth/me  (protected route — requires valid JWT)
  getMe(req, res) {
    // req.user was set by authMiddleware
    // We re-fetch from DB to get latest profile data
    const db = require('../db/database');
    const user = db.prepare(
      'SELECT id, username, email, avatar_url, bio, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  },
};

module.exports = authController;