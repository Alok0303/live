// stream.service.js
// All database operations for streams.

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const streamService = {

  // Create a new stream for a user
  createStream({ userId, title }) {
    // Generate a unique key used in the stream URL
    // e.g. "a3f9b2c1-..." → viewers go to /stream/a3f9b2c1-...
    const streamKey = uuidv4();

    const result = db.prepare(
      `INSERT INTO streams (user_id, title, stream_key)
       VALUES (?, ?, ?)`
    ).run(userId, title || 'My Live Stream', streamKey);

    return db.prepare(
      `SELECT s.*, u.username, u.avatar_url
       FROM streams s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`
    ).get(result.lastInsertRowid);
  },

  // Get all currently live streams (for homepage)
  getLiveStreams() {
    return db.prepare(
      `SELECT s.*, u.username, u.avatar_url
       FROM streams s
       JOIN users u ON s.user_id = u.id
       WHERE s.is_live = 1
       ORDER BY s.viewer_count DESC, s.started_at DESC`
    ).all();
  },

  // Get a single stream by its stream_key
  getStreamByKey(streamKey) {
    return db.prepare(
      `SELECT s.*, u.username, u.avatar_url, u.bio
       FROM streams s
       JOIN users u ON s.user_id = u.id
       WHERE s.stream_key = ?`
    ).get(streamKey);
  },

  // Get all streams (live or ended) by a user
  getStreamsByUser(userId) {
    return db.prepare(
      `SELECT * FROM streams
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).all(userId);
  },

  // Mark stream as live (called when streamer starts broadcasting)
  goLive(streamKey, userId) {
    const stream = db.prepare(
      'SELECT * FROM streams WHERE stream_key = ? AND user_id = ?'
    ).get(streamKey, userId);

    if (!stream) {
      const error = new Error('Stream not found or unauthorized');
      error.status = 404;
      throw error;
    }

    db.prepare(
      `UPDATE streams
       SET is_live = 1, started_at = CURRENT_TIMESTAMP, viewer_count = 0
       WHERE stream_key = ?`
    ).run(streamKey);

    return streamService.getStreamByKey(streamKey);
  },

  // Mark stream as ended
  endStream(streamKey, userId) {
    const stream = db.prepare(
      'SELECT * FROM streams WHERE stream_key = ? AND user_id = ?'
    ).get(streamKey, userId);

    if (!stream) {
      const error = new Error('Stream not found or unauthorized');
      error.status = 404;
      throw error;
    }

    db.prepare(
      `UPDATE streams
       SET is_live = 0, ended_at = CURRENT_TIMESTAMP
       WHERE stream_key = ?`
    ).run(streamKey);

    return { message: 'Stream ended' };
  },

  // Update viewer count (called by socket events)
  updateViewerCount(streamKey, delta) {
    // delta = +1 when viewer joins, -1 when viewer leaves
    db.prepare(
      `UPDATE streams
       SET viewer_count = MAX(0, viewer_count + ?)
       WHERE stream_key = ?`
    ).run(delta, streamKey);
  },
};

module.exports = streamService;