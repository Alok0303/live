// StreamPage.jsx
// Handles both broadcaster and viewer roles.
// isBroadcaster = URL has ?mode=broadcast

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useBroadcast } from '../context/BroadcastContext';
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
  const isBroadcaster = searchParams.get('mode') === 'broadcast' || 
                        (user && stream && user.id === stream.user_id);
  // Broadcaster duration timer
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(null);

  // Broadcaster media/peer state lives in the global BroadcastContext so it
  // survives navigation. Viewers keep a local, page-scoped connection.
  const broadcastCtx = useBroadcast();
  const viewerWebRTC = useWebRTC({ socket, streamKey, isBroadcaster: false });

  const {
    localVideoRef,
    remoteVideoRef,
    stopStream,
    toggleMute,
    toggleCamera,
    isStreaming,
    isMuted,
    isCameraOff,
    connectionState,
    error: webrtcError,
  } = isBroadcaster ? broadcastCtx : viewerWebRTC;

  // Re-attach the local preview <video> element whenever this page (re)mounts
  // while already broadcasting (e.g. you navigated away and came back).
  useEffect(() => {
    if (isBroadcaster && localVideoRef.current && broadcastCtx.localStreamRef?.current) {
      localVideoRef.current.srcObject = broadcastCtx.localStreamRef.current;
    }
  }, [isBroadcaster, localVideoRef, broadcastCtx.localStreamRef]);


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
    if (!socket || !stream || !user) return;

    const joinRoom = () => {
      console.log('Joining room:', streamKey, 'broadcaster:', isBroadcaster);
      socket.emit('stream:join', { streamKey, isBroadcaster, userId: user?.id });
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on('connect', joinRoom);

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
    socket.on('stream:broadcast-rejected', ({ reason }) => {
      setPageError(reason || 'This stream is already being broadcast elsewhere.');
      navigate('/');
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.off('viewer:count');
      socket.off('stream:started');
      socket.off('stream:ended');
      socket.off('stream:broadcast-rejected');
    };
  // ← stopStream removed from deps — it's now stable (empty useCallback)
  // ← this effect will only ever run once per socket/stream change
  }, [socket, stream, streamKey, isBroadcaster, user]);

  // ─── Viewer: leave cleanly on unmount/navigation ────────────────────────
  // The socket is app-level and survives route changes, so we have to tell
  // the server explicitly when a viewer navigates away — otherwise the
  // server (and the broadcaster's stale peer connection) never finds out,
  // and re-entering the stream later can get stuck.
  useEffect(() => {
    if (!socket || isBroadcaster) return;
    return () => {
      socket.emit('stream:leave', { streamKey });
      viewerWebRTC.stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, streamKey, isBroadcaster]);

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
      await broadcastCtx.startBroadcast(streamKey, false);
      await apiClient.patch(`/streams/${streamKey}/live`);
      socket.emit('stream:go-live', { streamKey });
      setIsLive(true);
    } catch (err) {
      // Surface the failure instead of swallowing it — if going live in the
      // DB fails, the broadcaster needs to know, or no one will ever see them.
      setPageError(err.response?.data?.error || 'Failed to go live. Please try again.');
      broadcastCtx.endBroadcast();
    }
  };

  const handleStartScreen = async () => {
    try {
      await broadcastCtx.startBroadcast(streamKey, true);
      await apiClient.patch(`/streams/${streamKey}/live`);
      socket.emit('stream:go-live', { streamKey });
      setIsLive(true);
    } catch (err) {
      setPageError(err.response?.data?.error || 'Failed to go live. Please try again.');
      broadcastCtx.endBroadcast();
    }
  };

  const handleEndStream = async () => {
    broadcastCtx.endBroadcast();
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

  // Compute whether broadcaster is too early to start
  const minutesUntilScheduled = stream?.scheduled_start_time
    ? (new Date(stream.scheduled_start_time) - Date.now()) / 60000
    : null;
  const isTooEarlyToStart = minutesUntilScheduled !== null && minutesUntilScheduled > 10;

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
                  <div className="text-center text-text-muted flex flex-col items-center px-4">
                    {isTooEarlyToStart ? (
                      <>
                        <div className="text-5xl mb-3">🔒</div>
                        <p className="text-brand font-bold text-lg">Too early to go live</p>
                        <p className="text-sm mt-2">
                          Your stream is scheduled for <br />
                          <span className="text-white font-semibold">
                            {new Date(stream.scheduled_start_time).toLocaleString()}
                          </span>
                        </p>
                        <p className="text-xs text-text-muted mt-2">
                          You can go live within 10 minutes of the scheduled time.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-5xl mb-3">🎥</div>
                        {stream?.scheduled_start_time && (
                          <p className="text-sm font-semibold text-brand mb-1">
                            Scheduled for {new Date(stream.scheduled_start_time).toLocaleString()}
                          </p>
                        )}
                        <p className="text-sm mt-1">Choose a source below to start</p>
                      </>
                    )}
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
          ) : stream?.scheduled_start_time && !isLive ? (
            /* Viewer sees countdown / waiting room */
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center text-center p-6">
              <div className="text-6xl mb-4">⏳</div>
              <h2 className="text-2xl font-bold text-white mb-2">Upcoming Stream</h2>
              <p className="text-brand font-semibold text-lg mb-1">
                Starts at {new Date(stream.scheduled_start_time).toLocaleString()}
              </p>
              <p className="text-text-muted text-sm mt-4">
                The stream will begin automatically when the broadcaster goes live. Hang tight!
              </p>
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

          {/* Go-live failure (e.g. DB update failed even though camera started) */}
          {isBroadcaster && pageError && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-md">
              {pageError}
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

          {/* Broadcaster controls — disabled if too early */}
          {isBroadcaster && (
            isTooEarlyToStart ? (
              <div className="bg-dark-surface border border-dark-border rounded-lg p-4 text-center">
                <p className="text-text-secondary text-sm">
                  🔒 Stream is locked until 10 minutes before the scheduled start time.
                </p>
                <p className="text-brand font-semibold text-sm mt-1">
                  Unlocks at {new Date(new Date(stream.scheduled_start_time) - 10 * 60 * 1000).toLocaleTimeString()}
                </p>
              </div>
            ) : (
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
            )
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