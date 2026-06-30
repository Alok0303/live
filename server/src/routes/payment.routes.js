// payment.routes.js

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const auth = require('../middleware/auth');

// Create payment intent (requires auth)
router.post('/create-intent', auth, paymentController.createPaymentIntent);

// Stripe webhook (does not require our app auth, handled by Stripe signature)
router.post('/webhook', paymentController.webhook);

module.exports = router;
