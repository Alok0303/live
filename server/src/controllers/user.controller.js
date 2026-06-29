// user.controller.js
// Handles user profile read and update.

const db = require('../db/database');
const logger = require('../utils/logger');

const userController = {

  // GET /api/users/:username
  getProfile(req, res) {
    const { username } = req.params;

    const user = db.prepare(
      'SELECT id, username, avatar_url, bio, created_at FROM users WHERE username = ?'
    ).get(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Also get their stream history
    const streams = db.prepare(
      `SELECT id, title, stream_key, is_live, viewer_count, started_at, ended_at
       FROM streams WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
    ).all(user.id);

    res.json({ user, streams });
  },

  // PATCH /api/users/me  (protected — update own profile)
  updateProfile(req, res, next) {
    try {
      const { bio, avatar_url } = req.body;
      const userId = req.user.id;

      // Only update fields that were provided
      db.prepare(
        `UPDATE users
         SET bio = COALESCE(?, bio),
             avatar_url = COALESCE(?, avatar_url),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(bio ?? null, avatar_url ?? null, userId);

      const updatedUser = db.prepare(
        'SELECT id, username, email, avatar_url, bio, created_at FROM users WHERE id = ?'
      ).get(userId);

      logger.info(`Profile updated: ${updatedUser.username}`);
      res.json({ user: updatedUser });

    } catch (err) {
      next(err);
    }
  },
};

module.exports = userController;