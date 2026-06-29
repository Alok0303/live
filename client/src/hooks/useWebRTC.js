// useWebRTC.js — Fixed version
// Key fixes:
// 1. Broadcaster queues viewers who join before stream starts
// 2. Tracks are added to peer connection BEFORE creating offer
// 3. Proper cleanup on unmount

import { useEffect, useRef, useCallback, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC({ socket, streamKey, isBroadcaster }) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnections = useRef(new Map());
  const localStream = useRef(null);

  // FIX 1: Queue viewers who join before stream starts
  const pendingViewers = useRef([]);

  const [isStreaming, setIsStreaming]         = useState(false);
  const [isMuted, setIsMuted]                 = useState(false);
  const [isCameraOff, setIsCameraOff]         = useState(false);
  const [connectionState, setConnectionState] = useState('idle');
  const [error, setError]                     = useState('');

  // ─── BROADCASTER: Create offer for a specific viewer ─────────────────────
  // This is now a standalone function called AFTER we have a local stream

  const createOfferForViewer = useCallback(async (viewerSocketId) => {
    if (!localStream.current) {
      console.warn('No local stream yet, queuing viewer:', viewerSocketId);
      pendingViewers.current.push(viewerSocketId);
      return;
    }
    if (!socket) return;

    console.log('Creating offer for viewer:', viewerSocketId);

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // FIX 2: Add tracks BEFORE creating the offer
    // This is critical — the offer must describe the tracks
    localStream.current.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current);
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('webrtc:ice-candidate', {
          candidate,
          targetSocketId: viewerSocketId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection to ${viewerSocketId}: ${pc.connectionState}`);
    };

    peerConnections.current.set(viewerSocketId, pc);

    // Create offer AFTER tracks are added
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('webrtc:offer', { offer, viewerSocketId });
    console.log('Offer sent to viewer:', viewerSocketId);
  }, [socket]);

  // ─── BROADCASTER: Get camera or screen ───────────────────────────────────

  const startLocalStream = useCallback(async (useScreen = false) => {
    try {
      setError('');
      let stream;

      if (useScreen) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        // Try to add mic audio too
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          mic.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch (_) {}
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width:     { ideal: 1280 },
            height:    { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });
      }

      localStream.current = stream;

      // Show local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsStreaming(true);

      // FIX 3: Now that we have a stream, send offers to any
      // viewers who joined while we were setting up
      console.log(`Stream ready. Sending offers to ${pendingViewers.current.length} queued viewers`);
      const queued = [...pendingViewers.current];
      pendingViewers.current = [];
      for (const viewerSocketId of queued) {
        await createOfferForViewer(viewerSocketId);
      }

      return stream;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera/mic permission denied. Please allow access and try again.'
        : `Could not start stream: ${err.message}`;
      setError(msg);
      throw err;
    }
  }, [createOfferForViewer]);

  // ─── VIEWER: Handle incoming offer ───────────────────────────────────────

  const handleOffer = useCallback(async ({ offer, broadcasterSocketId }) => {
    if (!socket) return;
    console.log('Received offer from broadcaster:', broadcasterSocketId);
    setConnectionState('connecting');

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // When video/audio tracks arrive — attach to video element
    pc.ontrack = (event) => {
      console.log('Got remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setConnectionState('connected');
          console.log('Remote stream attached to video element');
        }
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('webrtc:ice-candidate', {
          candidate,
          targetSocketId: broadcasterSocketId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Viewer connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    // ICE connection state gives more detail than connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionState('connected');
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('webrtc:answer', { answer, broadcasterSocketId });
    console.log('Answer sent to broadcaster');

    peerConnections.current.set(broadcasterSocketId, pc);
  }, [socket]);

  // ─── Socket event listeners ───────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    if (isBroadcaster) {
      socket.on('viewer:joined', ({ viewerSocketId }) => {
        console.log('Viewer joined:', viewerSocketId);
        createOfferForViewer(viewerSocketId);
      });

      socket.on('webrtc:answer', async ({ answer, viewerSocketId }) => {
        console.log('Got answer from viewer:', viewerSocketId);
        const pc = peerConnections.current.get(viewerSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

    } else {
      // Viewer receives offer
      socket.on('webrtc:offer', handleOffer);
    }

    // Both: receive ICE candidates
    socket.on('webrtc:ice-candidate', async ({ candidate, fromSocketId }) => {
      const pc = peerConnections.current.get(fromSocketId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {
          // Safe to ignore — can happen during renegotiation
        }
      }
    });

    return () => {
      socket.off('viewer:joined');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
    };
  }, [socket, isBroadcaster, createOfferForViewer, handleOffer]);

  // ─── Controls ─────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(prev => !prev);
  }, []);

  const stopStream = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    pendingViewers.current = [];

    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setIsStreaming(false);
    setConnectionState('idle');
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    startLocalStream,
    stopStream,
    toggleMute,
    toggleCamera,
    isStreaming,
    isMuted,
    isCameraOff,
    connectionState,
    error,
  };
}