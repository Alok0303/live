// auth.service.js
// Handles password hashing, user creation, and JWT generation.
// Keeping this separate from the controller makes it easy to test and reuse.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config/config');

const authService = {

  // Register a new user
  async register({ username, email, password }) {
    // Check if username already taken
    const existingUser = db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existingUser) {
      const error = new Error('Username or email already in use');
      error.status = 409; // Conflict
      throw error;
    }

    // Hash password — never store plain text
    // 10 = bcrypt cost factor (higher = slower but more secure)
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user into database
    const result = db.prepare(
      `INSERT INTO users (username, email, password_hash)
       VALUES (?, ?, ?)`
    ).run(username, email, passwordHash);

    // Fetch the newly created user (without password)
    const user = db.prepare(
      'SELECT id, username, email, avatar_url, bio, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    // Generate JWT token
    const token = authService.generateToken(user);

    return { user, token };
  },

  // Login existing user
  async login({ email, password }) {
    // Find user by email (include password_hash for comparison)
    const user = db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).get(email);

    if (!user) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }

    // Compare submitted password with stored hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }

    // Return user data without the password hash
    const { password_hash, ...safeUser } = user;
    const token = authService.generateToken(safeUser);

    return { user: safeUser, token };
  },

  // Generate a JWT token for a user
  generateToken(user) {
    return jwt.sign(
      // Payload stored inside the token (readable, not secret)
      { id: user.id, username: user.username, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  },
};

module.exports = authService;