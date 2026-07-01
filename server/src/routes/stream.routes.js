// stream.routes.js
const express = require('express');
const router = express.Router();
const streamController = require('../controllers/stream.controller');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// Public routes
router.get('/categories',         streamController.getCategories);   // list of categories
router.get('/',                   streamController.getLiveStreams);   // homepage feed
router.get('/past',               streamController.getPastStreams);   // past streams
router.get('/:streamKey',         streamController.getStream);       // single stream info

// Protected routes (must be logged in)
router.post('/',                          authMiddleware, streamController.createStream);
router.post('/upload-thumbnail',          authMiddleware, upload.single('thumbnail'), streamController.uploadThumbnail);
router.get('/my/streams',                 authMiddleware, streamController.getMyStreams);
router.patch('/:streamKey/live',          authMiddleware, streamController.goLive);
router.patch('/:streamKey/end',           authMiddleware, streamController.endStream);

module.exports = router;