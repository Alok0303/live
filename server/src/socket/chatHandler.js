// chatHandler.js
const db = require('../db/database');
const logger = require('../utils/logger');

const HISTORY_LIMIT = 50;

function registerChatHandlers(io, socket) {

  socket.on('chat:history', ({ streamKey }) => {
    try {
      const messages = db.prepare(`
        SELECT m.id, m.content, m.created_at,
               u.username, u.avatar_url
        FROM messages m
        JOIN streams s ON m.stream_id = s.id
        JOIN users u ON m.user_id = u.id
        WHERE s.stream_key = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(streamKey, HISTORY_LIMIT);

      socket.emit('chat:history', messages.reverse());
    } catch (err) {
      logger.error('chat:history error:', err);
      socket.emit('chat:error', { message: 'Failed to load chat history' });
    }
  });

  socket.on('chat:message', ({ streamKey, content, userId, username, avatar_url }) => {
    try {
      if (!content || typeof content !== 'string') return;
      const trimmed = content.trim();
      if (!trimmed || trimmed.length > 500) return;
      if (!userId || !streamKey) return;

      const stream = db.prepare(
        'SELECT id FROM streams WHERE stream_key = ?'
      ).get(streamKey);

      if (!stream) {
        socket.emit('chat:error', { message: 'Stream not found' });
        return;
      }

      const result = db.prepare(`
        INSERT INTO messages (stream_id, user_id, content)
        VALUES (?, ?, ?)
      `).run(stream.id, userId, trimmed);

      const message = {
        id: result.lastInsertRowid,
        content: trimmed,
        username,
        avatar_url: avatar_url || null,
        created_at: new Date().toISOString(),
      };

      io.to(streamKey).emit('chat:message', message);
    } catch (err) {
      logger.error('chat:message error:', err);
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });
}

module.exports = registerChatHandlers;