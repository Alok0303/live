// stream.controller.js
// Handles HTTP layer for stream routes.

const streamService = require('../services/stream.service');
const logger = require('../utils/logger');

const streamController = {

  // POST /api/streams  — create a new stream
  createStream(req, res, next) {
    try {
      const { title } = req.body;
      const userId = req.user.id;

      const stream = streamService.createStream({ userId, title });

      logger.info(`Stream created: ${stream.stream_key} by ${req.user.username}`);
      res.status(201).json({ stream });

    } catch (err) {
      next(err);
    }
  },

  // GET /api/streams  — get all live streams (homepage)
  getLiveStreams(_req, res, next) {
    try {
      const streams = streamService.getLiveStreams();
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
};

module.exports = streamController;