// user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth');

// Protected — update own profile (must be BEFORE /:username to avoid "me" being treated as a username)
router.patch('/me', authMiddleware, userController.updateProfile);

// Public — view any user's profile
router.get('/:username', userController.getProfile);

module.exports = router;