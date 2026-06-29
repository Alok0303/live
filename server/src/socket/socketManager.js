// socketManager.js
// Manages all Socket.IO events:
//   - WebRTC signaling (offer/answer/ICE candidates)
//   - Stream rooms (join/leave)
//   - Viewer counting
// This file is the heart of real-time communication.

const logger = require('../utils/logger');
const streamService = require('../services/stream.service');

// Track which sockets are in which rooms
// roomViewers: Map<streamKey, Set<socketId>>
const roomViewers = new Map();

// Track which socket is the broadcaster for each stream
// broadcasters: Map<streamKey, socketId>
const broadcasters = new Map();

function setupSocket(io) {

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Helper function to handle a viewer ready/joining logic cleanly
    const handleViewerReady = (streamKey) => {
      // Add viewer to room tracker if not already there
      if (!roomViewers.has(streamKey)) {
        roomViewers.set(streamKey, new Set());
      }
      
      const viewers = roomViewers.get(streamKey);
      
      // Only update database and broadcast if this is a newly tracked viewer connection
      if (!viewers.has(socket.id)) {
        viewers.add(socket.id);
        streamService.updateViewerCount(streamKey, +1);
      }

      // Tell the broadcaster a new viewer joined (triggers offer creation)
      // Small delay before telling broadcaster about new viewer.
      // This gives the viewer's socket time to register its
      // webrtc:offer listener before the offer arrives.
      const broadcasterSocketId = broadcasters.get(streamKey);
      if (broadcasterSocketId) {
        // 800ms delay — gives viewer's React component time to fully
        // mount and register the webrtc:offer socket listener
        setTimeout(() => {
          // Verify viewer is still connected before sending
          const viewerSocket = io.sockets.sockets.get(socket.id);
          if (viewerSocket) {
            io.to(broadcasterSocketId).emit('viewer:joined', {
              viewerSocketId: socket.id,
            });
            logger.info(`Notified broadcaster of viewer: ${socket.id}`);
          }
        }, 800);
      }

      // Broadcast updated viewer count to everyone in the room
      const count = viewers.size;
      io.to(streamKey).emit('viewer:count', { count });
      // Tell this specific viewer if the stream is already live
      // (they may have joined after stream:go-live was broadcast)
      const isAlreadyLive = broadcasters.has(streamKey);
      if (isAlreadyLive) {
        socket.emit('stream:started', { streamKey });
        // Also trigger a new offer from broadcaster to this viewer
        // (broadcaster's viewer:joined handler will do this automatically)
      }
    };

    // ─── Join a stream room ──────────────────────────────────────────────────
    // Called by BOTH streamers and viewers when they open a stream page
    socket.on('stream:join', ({ streamKey, isBroadcaster }) => {
      socket.join(streamKey);
      logger.info(`Socket ${socket.id} joined room ${streamKey} as ${isBroadcaster ? 'broadcaster' : 'viewer'}`);

      if (isBroadcaster) {
        // Register this socket as the broadcaster for this stream
        broadcasters.set(streamKey, socket.id);
        logger.info(`Broadcaster registered for stream: ${streamKey}`);
      } else {
        handleViewerReady(streamKey);
      }
    });

    // Explicit fallback catch for when the viewer UI mounts fully and demands an offer
    socket.on('viewer:ready', ({ streamKey }) => {
      logger.info(`Viewer ${socket.id} explicitly declared ready for stream room: ${streamKey}`);
      handleViewerReady(streamKey);
    });

    // ─── WebRTC Signaling ────────────────────────────────────────────────────
    // These 3 events form the WebRTC handshake.
    // The server is just a relay — it forwards messages between peers.

    // Streamer → Server → Viewer: "here's my stream description"
    socket.on('webrtc:offer', ({ offer, viewerSocketId }) => {
      logger.debug(`Forwarding offer to viewer: ${viewerSocketId}`);
      io.to(viewerSocketId).emit('webrtc:offer', {
        offer,
        broadcasterSocketId: socket.id,
      });
    });

    // Viewer → Server → Streamer: "here's my description, let's connect"
    socket.on('webrtc:answer', ({ answer, broadcasterSocketId }) => {
      logger.debug(`Forwarding answer to broadcaster: ${broadcasterSocketId}`);
      io.to(broadcasterSocketId).emit('webrtc:answer', {
        answer,
        viewerSocketId: socket.id,
      });
    });

    // Both directions: network path candidates for NAT traversal
    // targetSocketId = whoever should receive this candidate
    socket.on('webrtc:ice-candidate', ({ candidate, targetSocketId }) => {
      logger.debug(`Forwarding ICE candidate to: ${targetSocketId}`);
      io.to(targetSocketId).emit('webrtc:ice-candidate', {
        candidate,
        fromSocketId: socket.id,
        targetSocketId: targetSocketId, // Passed for explicit matching on hook
      });
    });

    // ─── Stream state events ─────────────────────────────────────────────────

    // Broadcaster tells server the stream is now live
    socket.on('stream:go-live', ({ streamKey }) => {
      logger.info(`Stream went live: ${streamKey}`);
      // Notify all viewers in the room
      socket.to(streamKey).emit('stream:started', { streamKey });
    });

    // Broadcaster ends the stream
    socket.on('stream:end', ({ streamKey }) => {
      logger.info(`Stream ended: ${streamKey}`);
      // Notify all viewers so they can show "stream ended" UI
      socket.to(streamKey).emit('stream:ended', { streamKey });
      // Clean up
      broadcasters.delete(streamKey);
      roomViewers.delete(streamKey);
    });

    // ─── Disconnect cleanup ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      // Check if this was a broadcaster
      for (const [streamKey, broadcasterSocketId] of broadcasters.entries()) {
        if (broadcasterSocketId === socket.id) {
          // Broadcaster left — notify viewers and clean up
          io.to(streamKey).emit('stream:ended', { streamKey });
          broadcasters.delete(streamKey);
          roomViewers.delete(streamKey);
          logger.info(`Broadcaster left stream: ${streamKey}`);
          break;
        }
      }

      // Check if this was a viewer
      for (const [streamKey, viewers] of roomViewers.entries()) {
        if (viewers.has(socket.id)) {
          viewers.delete(socket.id);
          streamService.updateViewerCount(streamKey, -1);

          // Tell remaining room members updated count
          const count = viewers.size;
          io.to(streamKey).emit('viewer:count', { count });
          logger.info(`Viewer left stream: ${streamKey}, count now: ${count}`);
          break;
        }
      }
    });
  });
}

module.exports = setupSocket;