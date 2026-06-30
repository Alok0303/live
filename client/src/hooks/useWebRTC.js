import { useEffect, useRef, useCallback, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC({ socket, streamKey, isBroadcaster }) {
  const localVideoRef   = useRef(null);
  const remoteVideoRef  = useRef(null);
  const peerConnections = useRef(new Map());
  const localStream     = useRef(null);
  const pendingViewers  = useRef([]);
  const socketRef       = useRef(socket); // stable ref to latest socket

  // Keep socketRef current without triggering re-renders
  useEffect(() => { socketRef.current = socket; }, [socket]);

  const [isStreaming,      setIsStreaming]      = useState(false);
  const [isMuted,          setIsMuted]          = useState(false);
  const [isCameraOff,      setIsCameraOff]      = useState(false);
  const [connectionState,  setConnectionState]  = useState('idle');
  const [error,            setError]            = useState('');

  // ─── BROADCASTER: create and send offer to one viewer ──────────────────
  // Uses socketRef so it never goes stale, and never changes reference
  const createOfferForViewer = useCallback(async (viewerSocketId) => {
    const sock = socketRef.current;
    if (!sock) return;

    if (!localStream.current) {
      console.warn('No stream yet — queuing viewer:', viewerSocketId);
      pendingViewers.current.push(viewerSocketId);
      return;
    }

    // We may get a duplicate "viewer joined" notification for the same
    // viewerSocketId — either a genuinely stale reconnect (viewer left and
    // came back) or just a harmless duplicate event (e.g. React StrictMode
    // double-invoking effects in dev). Only replace the connection if the
    // existing one is actually dead/dying — otherwise leave an
    // in-progress handshake alone, or we'll desync from the viewer (who
    // only acts on the FIRST offer it receives and ignores the rest).
    const existingPc = peerConnections.current.get(viewerSocketId);
    if (existingPc) {
      const deadStates = ['failed', 'disconnected', 'closed'];
      if (!deadStates.includes(existingPc.connectionState)) {
        console.log('Ignoring duplicate join for viewer (connection still active):', viewerSocketId, existingPc.connectionState);
        return;
      }
      console.warn('Replacing stale PC for viewer:', viewerSocketId, existingPc.connectionState);
      existingPc.close();
      peerConnections.current.delete(viewerSocketId);
    }

    console.log('Creating offer for viewer:', viewerSocketId);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add tracks BEFORE creating offer — critical
    localStream.current.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current);
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('webrtc:ice-candidate', {
          candidate,
          targetSocketId: viewerSocketId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`PC → ${viewerSocketId}: ${pc.connectionState}`);
    };

    peerConnections.current.set(viewerSocketId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sock.emit('webrtc:offer', { offer, viewerSocketId });
    console.log('Offer sent to:', viewerSocketId);
  }, []); // Empty deps — uses socketRef and localStream refs, both stable

  // ─── BROADCASTER: start webcam or screen ──────────────────────────────
  const startLocalStream = useCallback(async (useScreen = false) => {
    try {
      setError('');
      let stream;

      if (useScreen) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          mic.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch (_) {}
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true,
        });
      }

      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setIsStreaming(true);

      // Drain the queue of viewers who joined before stream started
      console.log(`Draining ${pendingViewers.current.length} queued viewers`);
      const queued = [...pendingViewers.current];
      pendingViewers.current = [];
      for (const id of queued) await createOfferForViewer(id);

      return stream;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera/mic permission denied. Please allow access and try again.'
        : `Could not start stream: ${err.message}`;
      setError(msg);
      throw err;
    }
  }, [createOfferForViewer]);

  // ─── VIEWER: handle incoming offer ────────────────────────────────────
  // Stored in a ref so the socket listener never needs to be re-registered
  const handleOfferRef = useRef(null);
  handleOfferRef.current = async ({ offer, broadcasterSocketId }) => {
    const sock = socketRef.current;
    if (!sock) return;

    // Avoid duplicate connections
    if (peerConnections.current.has(broadcasterSocketId)) {
      console.warn('Already have PC for broadcaster — ignoring duplicate offer');
      return;
    }

    console.log('Got offer from broadcaster:', broadcasterSocketId);
    setConnectionState('connecting');

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.ontrack = (event) => {
      console.log('Got remote track:', event.track.kind);
      if (remoteVideoRef.current) {
        let stream = remoteVideoRef.current.srcObject;
        if (!stream || !(stream instanceof MediaStream)) {
          stream = event.streams?.[0] || new MediaStream();
          remoteVideoRef.current.srcObject = stream;
        }
        if (!stream.getTracks().includes(event.track)) {
          stream.addTrack(event.track);
        }
        setConnectionState('connected');
        console.log('✅ Remote stream attached');
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('webrtc:ice-candidate', {
          candidate,
          targetSocketId: broadcasterSocketId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Viewer PC state:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionState('connected');
      }
    };

    peerConnections.current.set(broadcasterSocketId, pc);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sock.emit('webrtc:answer', { answer, broadcasterSocketId });
    console.log('Answer sent to broadcaster');

    // Drain queued candidates that arrived before setRemoteDescription
    if (pc.pendingCandidates) {
      console.log(`Draining ${pc.pendingCandidates.length} pending candidate(s) for broadcaster`);
      for (const cand of pc.pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('Failed to add queued candidate:', err);
        }
      }
      pc.pendingCandidates = [];
    }
  };

  // ─── Socket listeners — registered ONCE when socket is ready ──────────
  useEffect(() => {
    if (!socket) return;

    const handleViewerJoined = ({ viewerSocketId }) => {
      console.log('viewer:joined received:', viewerSocketId);
      createOfferForViewer(viewerSocketId);
    };

    const handleViewerLeft = ({ viewerSocketId }) => {
      const pc = peerConnections.current.get(viewerSocketId);
      if (pc) {
        console.log('Viewer left — closing stale PC:', viewerSocketId);
        pc.close();
        peerConnections.current.delete(viewerSocketId);
      }
      pendingViewers.current = pendingViewers.current.filter(id => id !== viewerSocketId);
    };

    const handleAnswer = async ({ answer, viewerSocketId }) => {
      console.log('Got answer from viewer:', viewerSocketId);
      const pc = peerConnections.current.get(viewerSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          if (pc.pendingCandidates) {
            console.log(`Draining ${pc.pendingCandidates.length} pending candidate(s) for viewer:`, viewerSocketId);
            for (const cand of pc.pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            pc.pendingCandidates = [];
          }
        } catch (err) {
          console.error('Error setting remote description or draining candidates:', err);
        }
      }
    };

    const handleOffer = (data) => handleOfferRef.current(data);

    const handleIceCandidate = async ({ candidate, fromSocketId }) => {
      const pc = peerConnections.current.get(fromSocketId);
      if (pc && candidate) {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            pc.pendingCandidates = pc.pendingCandidates || [];
            pc.pendingCandidates.push(candidate);
          }
        } catch (_) {}
      }
    };

    if (isBroadcaster) {
      socket.on('viewer:joined', handleViewerJoined);
      socket.on('viewer:left', handleViewerLeft);
      socket.on('webrtc:answer', handleAnswer);
    } else {
      socket.on('webrtc:offer', handleOffer);
    }

    socket.on('webrtc:ice-candidate', handleIceCandidate);

    return () => {
      if (isBroadcaster) {
        socket.off('viewer:joined', handleViewerJoined);
        socket.off('viewer:left', handleViewerLeft);
        socket.off('webrtc:answer', handleAnswer);
      } else {
        socket.off('webrtc:offer', handleOffer);
      }
      socket.off('webrtc:ice-candidate', handleIceCandidate);
    };
  }, [socket, isBroadcaster, createOfferForViewer]); // ← NO stopStream here

  // ─── Controls ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(p => !p);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(p => !p);
  }, []);

  // stopStream is stable — empty deps, uses only refs
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
  }, []); // ← empty deps — all refs, no state deps

  return {
    localVideoRef, remoteVideoRef,
    startLocalStream, stopStream,
    toggleMute, toggleCamera,
    isStreaming, isMuted, isCameraOff,
    connectionState, error,
    localStreamRef: localStream, // exposed so consumers can re-attach video after remount
  };
}