// auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');

// Public routes (no token needed)
router.post('/register', authController.register);
router.post('/login',    authController.login);

// Protected route (token required)
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;