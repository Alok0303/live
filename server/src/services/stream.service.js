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
  createStream({ userId, title, description, category, isPaid = false, price = 0, scheduledStartTime = null, thumbnailUrl = null }) {
    // Enforce one-active-stream-per-user
    const existing = streamService.getActiveStream(userId);
    if (existing) {
      const error = new Error('You already have an active live stream');
      error.status = 409;
      error.existingStream = existing;
      throw error;
    }

    // Validate scheduledStartTime: must be at least 24 hours in the future and at most 1 month
    if (scheduledStartTime) {
      const scheduled = new Date(scheduledStartTime);
      const minAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const maxAllowed = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (isNaN(scheduled.getTime())) {
        const error = new Error('Invalid scheduled start time');
        error.status = 400;
        throw error;
      }
      if (scheduled < minAllowed) {
        const error = new Error('Scheduled time must be at least 24 hours from now');
        error.status = 400;
        throw error;
      }
      if (scheduled > maxAllowed) {
        const error = new Error('Scheduled time cannot be more than 1 month from now');
        error.status = 400;
        throw error;
      }
    }

    // Validate price if paid
    if (isPaid && price < 100) {
      const error = new Error('Price must be at least $1.00 (100 cents)');
      error.status = 400;
      throw error;
    }

    // Generate a unique key used in the stream URL
    // e.g. "a3f9b2c1-..." → viewers go to /stream/a3f9b2c1-...
    const streamKey = uuidv4();

    // Default to a cute dog image if no thumbnail provided
    const finalThumbnail = thumbnailUrl || `https://placedog.net/640/360?random=${Math.random()}`;

    const result = db.prepare(
      `INSERT INTO streams (user_id, title, description, category, stream_key, is_paid, price, scheduled_start_time, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      title || 'My Live Stream',
      description || '',
      category || 'Just Chatting',
      streamKey,
      isPaid ? 1 : 0,
      isPaid ? Math.max(0, parseInt(price)) : 0,
      scheduledStartTime || null,
      finalThumbnail
    );

    return db.prepare(
      `SELECT s.*, u.username, u.avatar_url
       FROM streams s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`
    ).get(result.lastInsertRowid);
  },

  // Get all currently live streams OR upcoming streams (for homepage)
  getLiveStreams({ category } = {}) {
    if (category && category !== 'All') {
      return db.prepare(
        `SELECT s.*, u.username, u.avatar_url
         FROM streams s
         JOIN users u ON s.user_id = u.id
         WHERE (s.is_live = 1 OR s.scheduled_start_time > datetime('now'))
           AND s.category = ?
           AND (s.started_at IS NOT NULL OR s.scheduled_start_time IS NOT NULL)
         ORDER BY s.viewer_count DESC, s.started_at DESC, s.scheduled_start_time ASC`
      ).all(category);
    }
    return db.prepare(
      `SELECT s.*, u.username, u.avatar_url
       FROM streams s
       JOIN users u ON s.user_id = u.id
       WHERE (s.is_live = 1 OR s.scheduled_start_time > datetime('now'))
         AND (s.started_at IS NOT NULL OR s.scheduled_start_time IS NOT NULL)
       ORDER BY s.viewer_count DESC, s.started_at DESC, s.scheduled_start_time ASC`
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

    // Enforce 10-minute window: broadcaster can only go live within
    // 10 minutes BEFORE the scheduled start time.
    if (stream.scheduled_start_time) {
      const scheduledAt = new Date(stream.scheduled_start_time + 'Z');
      const now = new Date();
      const minutesUntilStart = (scheduledAt - now) / 60000; // positive = stream is in the future
      if (minutesUntilStart > 10) {
        const error = new Error(
          `You can only start streaming within 10 minutes of your scheduled time. Stream starts at ${scheduledAt.toLocaleString()}.`
        );
        error.status = 403;
        throw error;
      }
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