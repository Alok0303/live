// stream.service.js
// All database operations for streams.

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const streamService = {

  // Get the user's currently active (live) stream, if any
  getActiveStream(userId) {
    return db.prepare(
      `SELECT s.*, u.username, u.avatar_url
       FROM streams s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ? AND s.is_live = 1
       ORDER BY s.started_at DESC
       LIMIT 1`
    ).get(userId);
  },

  // Create a new stream for a user
  // Throws if the user already has a live stream (prevents duplicates)
  createStream({ userId, title, description, category }) {
    // Enforce one-active-stream-per-user
    const existing = streamService.getActiveStream(userId);
    if (existing) {
      const error = new Error('You already have an active live stream');
      error.status = 409;
      error.existingStream = existing;
      throw error;
    }

    // Generate a unique key used in the stream URL
    // e.g. "a3f9b2c1-..." → viewers go to /stream/a3f9b2c1-...
    const streamKey = uuidv4();

    const result = db.prepare(
      `INSERT INTO streams (user_id, title, description, category, stream_key)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      userId,
      title || 'My Live Stream',
      description || '',
      category || 'Just Chatting',
      streamKey
    );

    return db.prepare(
      `SELECT s.*, u.username, u.avatar_url
       FROM streams s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`
    ).get(result.lastInsertRowid);
  },

  // Get all currently live streams (for homepage)
  getLiveStreams({ category } = {}) {
    if (category && category !== 'All') {
      return db.prepare(
        `SELECT s.*, u.username, u.avatar_url
         FROM streams s
         JOIN users u ON s.user_id = u.id
         WHERE s.is_live = 1 AND s.category = ?
         ORDER BY s.viewer_count DESC, s.started_at DESC`
      ).all(category);
    }
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
       SET is_live = 1, started_at = CURRENT_TIMESTAMP, viewer_count = 0, peak_viewer_count = 0
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
       SET is_live = 0, ended_at = CURRENT_TIMESTAMP, viewer_count = 0
       WHERE stream_key = ?`
    ).run(streamKey);

    return { message: 'Stream ended' };
  },

  // Update viewer count (called by socket events)
  // Returns the new exact count so we can broadcast it
  updateViewerCount(streamKey, delta) {
    // delta = +1 when viewer joins, -1 when viewer leaves
    db.prepare(
      `UPDATE streams
       SET viewer_count = MAX(0, viewer_count + ?),
           peak_viewer_count = MAX(peak_viewer_count, viewer_count + ?)
       WHERE stream_key = ?`
    ).run(delta, delta, streamKey);

    const row = db.prepare(
      'SELECT viewer_count FROM streams WHERE stream_key = ?'
    ).get(streamKey);

    return row ? row.viewer_count : 0;
  },

  // Get all available categories (static list + dynamic from DB)
  getCategories() {
    const CATEGORIES = [
      'Just Chatting', 'Gaming', 'Music', 'Art', 'IRL',
      'Science & Technology', 'Sports', 'Cooking', 'Travel', 'Education',
    ];
    return CATEGORIES;
  },
};

module.exports = streamService;