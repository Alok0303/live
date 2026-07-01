// stream.controller.js
// Handles HTTP layer for stream routes.

const streamService = require('../services/stream.service');
const logger = require('../utils/logger');

const streamController = {

  // POST /api/streams/upload-thumbnail
  uploadThumbnail(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      // Assuming frontend and backend are on same host or handled by proxy,
      // return a relative URL like /uploads/filename.ext
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/streams  — create a new stream
  createStream(req, res, next) {
    try {
      const { title, description, category, isPaid, price, scheduledStartTime, thumbnailUrl } = req.body;
      const userId = req.user.id;

      const stream = streamService.createStream({ 
        userId, title, description, category, isPaid, price, scheduledStartTime, thumbnailUrl
      });

      logger.info(`Stream created: ${stream.stream_key} by ${req.user.username}`);
      res.status(201).json({ stream });

    } catch (err) {
      // 409 = user already has a live stream — return the existing one
      if (err.status === 409 && err.existingStream) {
        return res.status(409).json({
          error: err.message,
          existingStream: err.existingStream,
        });
      }
      next(err);
    }
  },

  // GET /api/streams  — get all live streams (homepage)
  getLiveStreams(req, res, next) {
    try {
      const { category } = req.query;
      const streams = streamService.getLiveStreams({ category });
      res.json({ streams });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/streams/:streamKey  — get single stream info
  getStream(req, res, next) {
    try {
      const stream = streamService.getStreamByKey(req.params.streamKey);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      res.json({ stream });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/streams/:streamKey/live  — go live
  goLive(req, res, next) {
    try {
      const stream = streamService.goLive(req.params.streamKey, req.user.id);
      logger.info(`Stream went live: ${stream.stream_key}`);
      res.json({ stream });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/streams/:streamKey/end  — end stream
  endStream(req, res, next) {
    try {
      const result = streamService.endStream(req.params.streamKey, req.user.id);
      logger.info(`Stream ended: ${req.params.streamKey}`);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/streams/my  — get current user's streams
  getMyStreams(req, res, next) {
    try {
      const streams = streamService.getStreamsByUser(req.user.id);
      res.json({ streams });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/streams/categories  — list of valid categories
  getCategories(_req, res, next) {
    try {
      const categories = streamService.getCategories();
      res.json({ categories });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/streams/past  — get all past streams
  getPastStreams(req, res, next) {
    try {
      const streams = streamService.getPastStreams();
      res.json({ streams });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/streams/my/active  — get current user's active live stream (if any)
  getActiveStream(req, res, next) {
    try {
      const stream = streamService.getActiveStream(req.user.id);
      res.json({ stream: stream || null });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = streamController;