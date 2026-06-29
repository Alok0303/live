// stream.routes.js
const express = require('express');
const router = express.Router();
const streamController = require('../controllers/stream.controller');
const authMiddleware = require('../middleware/auth');

// Public routes
router.get('/categories',         streamController.getCategories);   // list of categories
router.get('/',                   streamController.getLiveStreams);   // homepage feed
router.get('/:streamKey',         streamController.getStream);       // single stream info

// Protected routes (must be logged in)
router.post('/',                          authMiddleware, streamController.createStream);
router.get('/my/streams',                 authMiddleware, streamController.getMyStreams);
router.patch('/:streamKey/live',          authMiddleware, streamController.goLive);
router.patch('/:streamKey/end',           authMiddleware, streamController.endStream);

module.exports = router;