// socketManager.js
// Manages all Socket.IO events:
//   - WebRTC signaling (offer/answer/ICE candidates)
//   - Stream rooms (join/leave)
//   - Viewer counting (per-room + global lobby broadcast)
// This file is the heart of real-time communication.

const logger = require('../utils/logger');
const streamService = require('../services/stream.service');
const registerChatHandlers = require('./chatHandler');
const fs = require('fs');
const path = require('path');

// Track write streams for recordings
// writeStreams: Map<streamKey, fs.WriteStream>
const writeStreams = new Map();

// Track which sockets are in which rooms
// roomViewers: Map<streamKey, Set<socketId>>
const roomViewers = new Map();

// Track which socket is the broadcaster for each stream
// broadcasters: Map<streamKey, socketId>
const broadcasters = new Map();

// Special room name every homepage visitor joins to receive live feed updates
const LOBBY_ROOM = '__lobby__';

function setupSocket(io) {

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // ─── Chat ────────────────────────────────────────────────────────────────
    registerChatHandlers(io, socket);

    // ─── Lobby (homepage real-time updates) ──────────────────────────────────
    // Any client can subscribe to global stream updates (viewer counts, new streams)
    socket.on('lobby:join', () => {
      socket.join(LOBBY_ROOM);
      logger.debug(`Socket ${socket.id} joined lobby`);
    });

    socket.on('lobby:leave', () => {
      socket.leave(LOBBY_ROOM);
      logger.debug(`Socket ${socket.id} left lobby`);
    });

    // Helper: broadcast updated viewer count for a stream to both the room AND the lobby
    const broadcastViewerCount = (streamKey, count) => {
      // Tell everyone watching the stream
      io.to(streamKey).emit('viewer:count', { count });
      // Tell everyone on the homepage so StreamCard updates without polling
      io.to(LOBBY_ROOM).emit('stream:viewer_update', { streamKey, count });
    };

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
        const newCount = streamService.updateViewerCount(streamKey, +1);
        broadcastViewerCount(streamKey, newCount);
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
          if (socket.connected) {
            io.to(broadcasterSocketId).emit('viewer:joined', {
              viewerSocketId: socket.id,
            });
            logger.info(`Notified broadcaster of viewer: ${socket.id}`);
          }
        }, 800);
      }

      // Tell this specific viewer if the stream is already live
      // (they may have joined after stream:go-live was broadcast)
      const isAlreadyLive = broadcasters.has(streamKey);
      if (isAlreadyLive) {
        socket.emit('stream:started', { streamKey });
        // Also trigger a new offer from broadcaster to this viewer
        // (broadcaster's viewer:joined handler will do this automatically)
      }
    };

    // Helper: remove a viewer from a room's tracking, decrement count, and
    // tell the broadcaster to tear down the stale peer connection so a
    // later re-join isn't blocked by a "still active" dedupe check.
    const removeViewerFromRoom = (streamKey) => {
      const viewers = roomViewers.get(streamKey);
      if (!viewers || !viewers.has(socket.id)) return;

      viewers.delete(socket.id);
      const newCount = streamService.updateViewerCount(streamKey, -1);
      broadcastViewerCount(streamKey, newCount);

      const broadcasterSocketId = broadcasters.get(streamKey);
      if (broadcasterSocketId) {
        io.to(broadcasterSocketId).emit('viewer:left', { viewerSocketId: socket.id });
      }
      logger.info(`Viewer left stream: ${streamKey}, count now: ${newCount}`);
    };

    // ─── Join a stream room ──────────────────────────────────────────────────
    // Called by BOTH streamers and viewers when they open a stream page
    socket.on('stream:join', ({ streamKey, isBroadcaster, userId }) => {
      const db = require('../db/database');
      const stream = streamService.getStreamByKey(streamKey);
      
      // If it's a paid stream, verify access
      if (stream && stream.is_paid && !isBroadcaster && userId !== stream.user_id) {
        if (!userId) {
          socket.emit('stream:payment-required', { streamKey });
          return;
        }
        
        const purchase = db.prepare(
          'SELECT * FROM stream_purchases WHERE user_id = ? AND stream_id = ? AND status = ?'
        ).get(userId, stream.id, 'succeeded');
        
        if (!purchase) {
          socket.emit('stream:payment-required', { streamKey });
          return;
        }
      }

      if (isBroadcaster) {
        // Reject a second concurrent broadcaster connection for the same
        // stream (e.g. opened in a second tab) instead of silently
        // overwriting the registration and orphaning the first one.
        const existingBroadcasterId = broadcasters.get(streamKey);
        if (existingBroadcasterId && existingBroadcasterId !== socket.id) {
          const existingSocket = io.sockets.sockets.get(existingBroadcasterId);
          if (existingSocket && existingSocket.connected) {
            logger.warn(`Rejected duplicate broadcaster join for ${streamKey} from ${socket.id}`);
            socket.emit('stream:broadcast-rejected', {
              reason: 'You are already broadcasting this stream from another tab or device.',
            });
            return;
          }
        }
      }

      socket.join(streamKey);
      logger.info(`Socket ${socket.id} joined room ${streamKey} as ${isBroadcaster ? 'broadcaster' : 'viewer'}`);

      if (isBroadcaster) {
        // Register this socket as the broadcaster for this stream
        broadcasters.set(streamKey, socket.id);
        logger.info(`Broadcaster registered for stream: ${streamKey}`);

        // Catch up on any viewers who already joined this room BEFORE the
        // broadcaster (re-)registered (e.g. broadcaster navigated away and
        // back). Without this, those viewers are never told to expect an
        // offer and get stuck forever on "waiting for stream to start".
        const existingViewers = roomViewers.get(streamKey);
        if (existingViewers && existingViewers.size > 0) {
          logger.info(`Notifying broadcaster of ${existingViewers.size} pre-existing viewer(s)`);
          existingViewers.forEach(viewerSocketId => {
            const viewerSocket = io.sockets.sockets.get(viewerSocketId);
            if (viewerSocket) {
              io.to(socket.id).emit('viewer:joined', { viewerSocketId });
              // Also let that viewer know the stream is live, in case they
              // joined before any 'stream:started' broadcast went out.
              io.to(viewerSocketId).emit('stream:started', { streamKey });
            }
          });
        }
      } else {
        handleViewerReady(streamKey);
      }
    });

    // Explicit fallback catch for when the viewer UI mounts fully and demands an offer
    socket.on('viewer:ready', ({ streamKey }) => {
      logger.info(`Viewer ${socket.id} explicitly declared ready for stream room: ${streamKey}`);
      handleViewerReady(streamKey);
    });

    // Viewer explicitly leaving a stream page (navigating away, clicking
    // back, etc). Lets them exit and re-enter a stream as many times as
    // they like without getting stuck behind a stale peer connection.
    socket.on('stream:leave', ({ streamKey }) => {
      socket.leave(streamKey);
      removeViewerFromRoom(streamKey);
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
      // Notify lobby (homepage) so the stream appears instantly
      io.to(LOBBY_ROOM).emit('stream:went_live', { streamKey });
    });

    // Broadcaster ends the stream
    socket.on('stream:end', ({ streamKey }) => {
      logger.info(`Stream ended: ${streamKey}`);
      // Notify all viewers so they can show "stream ended" UI
      socket.to(streamKey).emit('stream:ended', { streamKey });
      // Notify lobby (homepage) so the card disappears instantly
      io.to(LOBBY_ROOM).emit('stream:went_offline', { streamKey });
      
      // Close recording if active
      const ws = writeStreams.get(streamKey);
      if (ws) {
        ws.end();
        writeStreams.delete(streamKey);
      }

      // Clean up
      broadcasters.delete(streamKey);
      roomViewers.delete(streamKey);
    });

    // ─── Stream Recording ────────────────────────────────────────────────────
    
    socket.on('stream:record_chunk', ({ streamKey, chunk }) => {
      // Validate broadcaster
      if (broadcasters.get(streamKey) !== socket.id) return;
      
      let ws = writeStreams.get(streamKey);
      if (!ws) {
        const filePath = path.join(__dirname, '../../uploads', `recording_${streamKey}.webm`);
        // Ensure uploads dir exists
        const uploadDir = path.dirname(filePath);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        ws = fs.createWriteStream(filePath, { flags: 'a' });
        writeStreams.set(streamKey, ws);
      }
      ws.write(chunk);
    });

    socket.on('stream:record_end', ({ streamKey }) => {
      if (broadcasters.get(streamKey) !== socket.id) return;
      
      const ws = writeStreams.get(streamKey);
      if (ws) {
        ws.end();
        writeStreams.delete(streamKey);
        const url = `/uploads/recording_${streamKey}.webm`;
        streamService.saveRecordingUrl(streamKey, url);
        logger.info(`Recording saved for ${streamKey} at ${url}`);
      }
    });

    // ─── Disconnect cleanup ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      // Check if this was a broadcaster
      for (const [streamKey, broadcasterSocketId] of broadcasters.entries()) {
        if (broadcasterSocketId === socket.id) {
          // Broadcaster left — persist the end in the DB, notify viewers, and clean up
          try {
            const stream = streamService.getStreamByKey(streamKey);
            if (stream && stream.is_live) {
              streamService.endStream(streamKey, stream.user_id);
            }
          } catch (err) {
            logger.error(`Failed to end stream ${streamKey} on disconnect: ${err.message}`);
          }
          io.to(streamKey).emit('stream:ended', { streamKey });
          io.to(LOBBY_ROOM).emit('stream:went_offline', { streamKey });
          
          // Close recording if active
          const ws = writeStreams.get(streamKey);
          if (ws) {
            ws.end();
            writeStreams.delete(streamKey);
            const url = `/uploads/recording_${streamKey}.webm`;
            streamService.saveRecordingUrl(streamKey, url);
            logger.info(`Recording saved for ${streamKey} at ${url} (on disconnect)`);
          }

          broadcasters.delete(streamKey);
          roomViewers.delete(streamKey);
          logger.info(`Broadcaster left stream: ${streamKey}`);
          break;
        }
      }

      // Check if this was a viewer
      for (const streamKey of roomViewers.keys()) {
        const viewers = roomViewers.get(streamKey);
        if (viewers && viewers.has(socket.id)) {
          removeViewerFromRoom(streamKey);
          break;
        }
      }
    });
  });
}

module.exports = setupSocket;