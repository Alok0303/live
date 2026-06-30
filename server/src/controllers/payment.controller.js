// payment.controller.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
const db = require('../db/database');
const logger = require('../utils/logger');
const streamService = require('../services/stream.service');

const paymentController = {

  // POST /api/payments/create-intent
  async createPaymentIntent(req, res, next) {
    try {
      const { streamKey } = req.body;
      const userId = req.user.id;

      const stream = streamService.getStreamByKey(streamKey);
      if (!stream) return res.status(404).json({ error: 'Stream not found' });
      if (!stream.is_paid || stream.price <= 0) {
        return res.status(400).json({ error: 'Stream is not paid' });
      }

      // Check if user already purchased
      const existing = db.prepare(
        'SELECT * FROM stream_purchases WHERE user_id = ? AND stream_id = ? AND status = ?'
      ).get(userId, stream.id, 'succeeded');
      if (existing) {
        return res.status(400).json({ error: 'Already purchased' });
      }

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: stream.price,
        currency: 'usd',
        metadata: {
          streamId: stream.id,
          userId: userId,
        },
      });

      // Record pending purchase
      db.prepare(
        `INSERT INTO stream_purchases (user_id, stream_id, stripe_pi_id, status)
         VALUES (?, ?, ?, ?)`
      ).run(userId, stream.id, paymentIntent.id, 'pending');

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/payments/webhook
  // Note: we need the raw body for Stripe signature verification, which requires specific middleware
  // For simplicity in development without webhook signatures, we just parse the body.
  // In production, you MUST use express.raw({type: 'application/json'}) and verify the signature.
  async webhook(req, res) {
    let event = req.body;
    
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const piId = paymentIntent.id;
        
        // Update purchase status in DB
        db.prepare(
          `UPDATE stream_purchases SET status = 'succeeded' WHERE stripe_pi_id = ?`
        ).run(piId);
        
        logger.info(`Payment succeeded for PI: ${piId}`);
        break;
      
      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object;
        db.prepare(
          `UPDATE stream_purchases SET status = 'failed' WHERE stripe_pi_id = ?`
        ).run(failedIntent.id);
        break;
        
      default:
        logger.debug(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({received: true});
  }
};

module.exports = paymentController;
