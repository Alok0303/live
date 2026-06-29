// StreamPage.jsx
// Handles both broadcaster and viewer roles.
// isBroadcaster = URL has ?mode=broadcast

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoPlayer from '../components/stream/VideoPlayer';
import StreamControls from '../components/stream/StreamControls';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function StreamPage() {
  const { streamKey } = useParams();
  const [searchParams] = useSearchParams();
  const isBroadcaster = searchParams.get('mode') === 'broadcast';

  const socket   = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stream, setStream]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamEnded, setStreamEnded] = useState(false);
  const [isLive, setIsLive]           = useState(false);
  const [pageError, setPageError]     = useState('');

  const {
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
    error: webrtcError,
  } = useWebRTC({ socket, streamKey, isBroadcaster });

  // ─── Load stream info ───────────────────────────────────────────────────

  useEffect(() => {
    apiClient.get(`/streams/${streamKey}`)
      .then(res => {
        setStream(res.data.stream);
        setIsLive(!!res.data.stream.is_live);
        setViewerCount(res.data.stream.viewer_count || 0);
      })
      .catch(() => setPageError('Stream not found'))
      .finally(() => setLoading(false));
  }, [streamKey]);

  // ─── Join socket room ───────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !stream) return;

    // Join the stream's socket room
    socket.emit('stream:join', { streamKey, isBroadcaster });

    // Listen for viewer count updates
    socket.on('viewer:count', ({ count }) => setViewerCount(count));

    // Viewer: broadcaster started streaming
    socket.on('stream:started', () => setIsLive(true));

    // Stream ended (broadcaster left or clicked End Stream)
    socket.on('stream:ended', () => {
      setStreamEnded(true);
      setIsLive(false);
      stopStream();
    });

    return () => {
      socket.off('viewer:count');
      socket.off('stream:started');
      socket.off('stream:ended');
    };
  }, [socket, stream, streamKey, isBroadcaster, stopStream]);

  // ─── Broadcaster actions ────────────────────────────────────────────────

  const handleStartWebcam = async () => {
    try {
      await startLocalStream(false);
      // Mark stream as live in DB
      await apiClient.patch(`/streams/${streamKey}/live`);
      // Notify viewers via socket
      socket.emit('stream:go-live', { streamKey });
      setIsLive(true);
    } catch (_) {
      // Error already set in useWebRTC
    }
  };

  const handleStartScreen = async () => {
    try {
      await startLocalStream(true);
      await apiClient.patch(`/streams/${streamKey}/live`);
      socket.emit('stream:go-live', { streamKey });
      setIsLive(true);
    } catch (_) {}
  };

  const handleEndStream = async () => {
    stopStream();
    socket.emit('stream:end', { streamKey });
    await apiClient.patch(`/streams/${streamKey}/end`).catch(() => {});
    navigate('/');
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );

  if (pageError) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-text-secondary text-lg mb-4">{pageError}</p>
        <button onClick={() => navigate('/')} className="btn-secondary">Back to Home</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Stream ended banner */}
      {streamEnded && (
        <div className="bg-dark-surface border border-dark-border rounded-lg p-4 mb-4 text-center">
          <p className="text-text-secondary">This stream has ended.</p>
          <button onClick={() => navigate('/')} className="btn-secondary text-sm mt-2">
            Back to Home
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Video + info + controls */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Video */}
          {isBroadcaster ? (
            /* Broadcaster sees their own local preview */
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted   /* muted so you don't hear yourself */
                playsInline
                className="w-full h-full object-cover"
              />
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-base">
                  <div className="text-center text-text-muted">
                    <div className="text-5xl mb-3">🎥</div>
                    <p className="text-sm">Choose a source below to start</p>
                  </div>
                </div>
              )}
              {/* Live indicator overlay */}
              {isStreaming && (
                <div className="absolute top-3 left-3">
                  <span className="live-badge">● LIVE</span>
                </div>
              )}
            </div>
          ) : (
            /* Viewer sees incoming remote stream */
            <VideoPlayer
              videoRef={remoteVideoRef}
              connectionState={connectionState}
              isLive={isLive}
            />
          )}

          {/* WebRTC error */}
          {webrtcError && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-md">
              {webrtcError}
            </div>
          )}

          {/* Stream info bar */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {isLive
                  ? <span className="live-badge">● Live</span>
                  : <span className="bg-dark-hover text-text-secondary text-xs font-bold px-2 py-0.5 rounded uppercase">Offline</span>
                }
                <h1 className="text-text-primary font-semibold">{stream?.title}</h1>
              </div>
              <p className="text-text-secondary text-sm">{stream?.username}</p>
            </div>
            <div className="text-text-secondary text-sm flex-shrink-0 flex items-center gap-1">
              <span>👁</span>
              <span>{viewerCount}</span>
            </div>
          </div>

          {/* Broadcaster controls */}
          {isBroadcaster && (
            <StreamControls
              isStreaming={isStreaming}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              onStartWebcam={handleStartWebcam}
              onStartScreen={handleStartScreen}
              onEndStream={handleEndStream}
            />
          )}
        </div>

        {/* Right: Chat — placeholder, filled in Phase 5 */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <div className="bg-dark-surface border border-dark-border rounded-lg flex flex-col"
               style={{ height: '500px' }}>
            <div className="p-3 border-b border-dark-border">
              <h2 className="text-text-primary font-semibold text-sm">Stream Chat</h2>
            </div>
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
              Chat coming in Phase 5
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}