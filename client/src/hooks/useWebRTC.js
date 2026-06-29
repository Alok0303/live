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

  const [isStreaming, setIsStreaming]       = useState(false);
  const [isMuted, setIsMuted]               = useState(false);
  const [isCameraOff, setIsCameraOff]       = useState(false);
  const [connectionState, setConnectionState] = useState('idle');
  const [error, setError]                   = useState('');

  // BROADCASTER: Get camera/mic or screen share
  const startLocalStream = useCallback(async (useScreen = false) => {
    try {
      setError('');
      let stream;

      if (useScreen) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });

        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getAudioTracks().forEach(track => screenStream.addTrack(track));
        } catch (_) {}

        stream = screenStream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true,
        });
      }

      localStream.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      return stream;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera/mic permission denied. Please allow access and try again.'
        : `Could not start stream: ${err.message}`;
      setError(msg);
      throw err;
    }
  }, []);

  // BROADCASTER: Create peer connection for an individual viewer
  const createPeerConnectionForViewer = useCallback((viewerSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('webrtc:ice-candidate', {
          candidate,
          targetSocketId: viewerSocketId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    peerConnections.current.set(viewerSocketId, pc);
    return pc;
  }, [socket]);

  // BROADCASTER: Generate and send the WebRTC offer
  const sendOffer = useCallback(async (viewerSocketId) => {
    try {
      const pc = createPeerConnectionForViewer(viewerSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { offer, viewerSocketId });
    } catch (err) {
      console.error("Failed to send WebRTC offer:", err);
    }
  }, [createPeerConnectionForViewer, socket]);

  // VIEWER: Accept incoming offer from broadcaster and send answer back
  const handleOffer = useCallback(async ({ offer, broadcasterSocketId }) => {
    try {
      setConnectionState('connecting');
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.ontrack = ({ streams }) => {
        if (streams[0] && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = streams[0];
          setConnectionState('connected');
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socket) {
          socket.emit('webrtc:ice-candidate', {
            candidate,
            targetSocketId: broadcasterSocketId,
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', { answer, broadcasterSocketId });
      peerConnections.current.set(broadcasterSocketId, pc);
    } catch (err) {
      console.error("Error handling WebRTC offer:", err);
      setConnectionState('failed');
    }
  }, [socket]);

  // Handle all real-time signalling coordination
  useEffect(() => {
    if (!socket) return;

    if (isBroadcaster) {
      // When a viewer enters the room, send them an offer
      socket.on('viewer:joined', ({ viewerSocketId }) => {
        sendOffer(viewerSocketId);
      });

      // Handle the connection answer back from the viewer
      socket.on('webrtc:answer', async ({ answer, viewerSocketId }) => {
        const pc = peerConnections.current.get(viewerSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });
    } else {
      // Viewer listens for incoming offer
      socket.on('webrtc:offer', handleOffer);
      
      // Let the broadcaster know we are inside the room and ready for the stream
      socket.emit('viewer:ready', { streamKey });
    }

    // Capture and attach network route candidates for both sides
    socket.on('webrtc:ice-candidate', async ({ candidate, fromSocketId, targetSocketId }) => {
      const activePeerId = fromSocketId || targetSocketId;
      let pc = peerConnections.current.get(activePeerId);
      
      // Viewer fallback optimization
      if (!isBroadcaster && peerConnections.current.size === 1) {
        pc = peerConnections.current.values().next().value;
      }

      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          // Connection may already be completed
        }
      }
    });

    return () => {
      socket.off('viewer:joined');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
    };
  }, [socket, isBroadcaster, sendOffer, handleOffer, streamKey]);

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff(prev => !prev);
  }, []);

  const stopStream = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;

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