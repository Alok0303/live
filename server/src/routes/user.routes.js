// user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth');

// Public — view any user's profile
router.get('/:username', userController.getProfile);

// Protected — update own profile
router.patch('/me', authMiddleware, userController.updateProfile);

module.exports = router;