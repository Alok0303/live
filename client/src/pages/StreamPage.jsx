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
import ChatBox from '../components/chat/ChatBox';
import { useChat } from '../hooks/useChat';

// Format elapsed seconds as HH:MM:SS
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Category badge color map
const CATEGORY_COLORS = {
  'Gaming':               'bg-blue-900/60 text-blue-300',
  'Music':                'bg-pink-900/60 text-pink-300',
  'Art':                  'bg-orange-900/60 text-orange-300',
  'IRL':                  'bg-green-900/60 text-green-300',
  'Science & Technology': 'bg-cyan-900/60 text-cyan-300',
  'Sports':               'bg-yellow-900/60 text-yellow-300',
  'Cooking':              'bg-red-900/60 text-red-300',
  'Travel':               'bg-teal-900/60 text-teal-300',
  'Education':            'bg-purple-900/60 text-purple-300',
  'Just Chatting':        'bg-gray-700/60 text-gray-300',
};

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
  const [peakViewers, setPeakViewers] = useState(0);
  const [streamEnded, setStreamEnded] = useState(false);
  const [isLive, setIsLive]           = useState(false);
  const [pageError, setPageError]     = useState('');

  // Broadcaster duration timer
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(null);

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
  const { messages, inputText, setInputText, sendMessage, handleKeyDown, error: chatError, bottomRef } = useChat({ socket, streamKey, user });

  // ─── Load stream info ───────────────────────────────────────────────────

  useEffect(() => {
    apiClient.get(`/streams/${streamKey}`)
      .then(res => {
        setStream(res.data.stream);
        setIsLive(!!res.data.stream.is_live);
        setViewerCount(res.data.stream.viewer_count || 0);
        setPeakViewers(res.data.stream.peak_viewer_count || 0);
      })
      .catch(() => setPageError('Stream not found'))
      .finally(() => setLoading(false));
  }, [streamKey]);

  // ─── Join socket room ───────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !stream) return;

    const joinRoom = () => {
      console.log('Joining room:', streamKey, 'broadcaster:', isBroadcaster);
      socket.emit('stream:join', { streamKey, isBroadcaster });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once('connect', joinRoom);
    }

    socket.on('viewer:count', ({ count }) => {
      setViewerCount(count);
      setPeakViewers(prev => Math.max(prev, count));
    });
    socket.on('stream:started', () => setIsLive(true));
    socket.on('stream:ended', () => {
      setStreamEnded(true);
      setIsLive(false);
      stopStream();
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.off('viewer:count');
      socket.off('stream:started');
      socket.off('stream:ended');
    };
  // ← stopStream removed from deps — it's now stable (empty useCallback)
  // ← this effect will only ever run once per socket/stream change
  }, [socket, stream, streamKey, isBroadcaster]); // eslint-disable-line

  // ─── Broadcaster duration timer ─────────────────────────────────────────

  useEffect(() => {
    if (isStreaming && !durationRef.current) {
      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    if (!isStreaming && durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
      setDuration(0);
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [isStreaming]);

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

  const catColor = CATEGORY_COLORS[stream?.category] || CATEGORY_COLORS['Just Chatting'];

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
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="live-badge">● LIVE</span>
                  <span className="bg-black/70 text-white text-xs font-mono px-2 py-0.5 rounded">
                    {formatTime(duration)}
                  </span>
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {isLive
                  ? <span className="live-badge">● Live</span>
                  : <span className="bg-dark-hover text-text-secondary text-xs font-bold px-2 py-0.5 rounded uppercase">Offline</span>
                }
                <h1 className="text-text-primary font-semibold truncate">{stream?.title}</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-text-secondary text-sm">{stream?.username}</p>
                {stream?.category && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor}`}>
                    {stream.category}
                  </span>
                )}
              </div>
              {/* Description */}
              {stream?.description && (
                <p className="text-text-muted text-xs mt-1.5 leading-relaxed line-clamp-2">
                  {stream.description}
                </p>
              )}
            </div>
            <div className="text-text-secondary text-sm flex-shrink-0 flex items-center gap-1">
              <span>👁</span>
              <span className="font-medium">{viewerCount.toLocaleString()}</span>
            </div>
          </div>

          {/* Broadcaster stats panel */}
          {isBroadcaster && isStreaming && (
            <div className="bg-dark-surface border border-dark-border rounded-lg p-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-text-muted text-xs mb-0.5">Duration</p>
                <p className="text-text-primary font-mono font-semibold">{formatTime(duration)}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">Viewers</p>
                <p className="text-text-primary font-semibold">{viewerCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">Peak</p>
                <p className="text-text-primary font-semibold">{peakViewers.toLocaleString()}</p>
              </div>
            </div>
          )}

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

        {/* Right: Chat */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <ChatBox
            messages={messages}
            inputText={inputText}
            setInputText={setInputText}
            sendMessage={sendMessage}
            handleKeyDown={handleKeyDown}
            error={chatError}
            bottomRef={bottomRef}
            user={user}
          />
        </div>
      </div>
    </div>
  );
}