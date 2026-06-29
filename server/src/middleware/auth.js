// auth.js
// Middleware that protects routes requiring login.
// Usage: router.get('/profile', authMiddleware, controller)
// It reads the JWT from the Authorization header, verifies it,
// and attaches the user payload to req.user

const jwt = require('jsonwebtoken');
const config = require('../config/config');

const authMiddleware = (req, res, next) => {
  // Token comes in header: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token using our secret key
    const decoded = jwt.verify(token, config.jwt.secret);
    // Attach decoded user info to request so controllers can use it
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;