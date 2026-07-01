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

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const CATEGORY_COLORS = {
  'Gaming':               'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Music':                'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Art':                  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'IRL':                  'bg-green-500/20 text-green-300 border-green-500/30',
  'Science & Technology': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Sports':               'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Cooking':              'bg-red-500/20 text-red-300 border-red-500/30',
  'Travel':               'bg-teal-500/20 text-teal-300 border-teal-500/30',
  'Education':            'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Just Chatting':        'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
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
  const isBroadcaster = (searchParams.get('mode') === 'broadcast' || 
                        (user && stream && user.id === stream.user_id)) && 
                        !stream?.recording_url;
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(null);

  const broadcastCtx = useBroadcast();
  const viewerWebRTC = useWebRTC({ socket, streamKey, isBroadcaster: false });

  const {
    localVideoRef, remoteVideoRef,
    stopStream, toggleMute, toggleCamera,
    isStreaming, isMuted, isCameraOff,
    connectionState, error: webrtcError,
  } = isBroadcaster ? broadcastCtx : viewerWebRTC;

  useEffect(() => {
    if (isBroadcaster && localVideoRef.current && broadcastCtx.localStreamRef?.current) {
      localVideoRef.current.srcObject = broadcastCtx.localStreamRef.current;
    }
  }, [isBroadcaster, localVideoRef, broadcastCtx.localStreamRef]);

  const { messages, inputText, setInputText, sendMessage, handleKeyDown, error: chatError, bottomRef } = useChat({ socket, streamKey, user });

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

  useEffect(() => {
    if (!socket || !stream || !user) return;
    const joinRoom = () => {
      console.log('Joining room:', streamKey, 'broadcaster:', isBroadcaster);
      socket.emit('stream:join', { streamKey, isBroadcaster, userId: user?.id });
    };
    if (socket.connected) joinRoom();
    socket.on('connect', joinRoom);
    socket.on('viewer:count', ({ count }) => {
      setViewerCount(count);
      setPeakViewers(prev => Math.max(prev, count));
    });
    socket.on('stream:started', () => setIsLive(true));
    socket.on('stream:ended', () => { setStreamEnded(true); setIsLive(false); stopStream(); });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, stream, streamKey, isBroadcaster, user]);

  useEffect(() => {
    if (!socket || isBroadcaster) return;
    return () => {
      socket.emit('stream:leave', { streamKey });
      viewerWebRTC.stopStream();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, streamKey, isBroadcaster]);

  useEffect(() => {
    if (isStreaming && !durationRef.current) {
      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    if (!isStreaming && durationRef.current) {
      clearInterval(durationRef.current); durationRef.current = null; setDuration(0);
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, [isStreaming]);

  const handleStartWebcam = async () => {
    try {
      await broadcastCtx.startBroadcast(streamKey, false);
      await apiClient.patch(`/streams/${streamKey}/live`);
      socket.emit('stream:go-live', { streamKey });
      setIsLive(true);
    } catch (err) {
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

  // ─── Loading / Error ────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );

  if (pageError && !stream) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl">📡</div>
        <p className="text-text-secondary text-lg">{pageError}</p>
        <button onClick={() => navigate('/')} className="btn-primary">Back to Home</button>
      </div>
    </div>
  );

  const catColor = CATEGORY_COLORS[stream?.category] || CATEGORY_COLORS['Just Chatting'];
  const minutesUntilScheduled = stream?.scheduled_start_time
    ? (new Date(stream.scheduled_start_time) - Date.now()) / 60000
    : null;
  const isTooEarlyToStart = minutesUntilScheduled !== null && minutesUntilScheduled > 10;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-text-primary flex flex-col">

      {/* Stream-ended banner */}
      {streamEnded && (
        <div className="bg-brand/10 border-b border-brand/30 px-6 py-3 flex items-center justify-between">
          <p className="text-text-secondary text-sm">This stream has ended.</p>
          <button onClick={() => navigate('/')} className="btn-primary text-sm py-1 px-4">
            Browse Streams
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 pt-16">

        {/* ── Left: Video + Info + Controls ── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Video area */}
          <div className="w-full bg-black">
            {isBroadcaster ? (
              <div className="relative w-full aspect-video bg-black">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
                    <div className="text-center px-6 max-w-sm">
                      {isTooEarlyToStart ? (
                        <>
                          <div className="text-5xl mb-4 opacity-60">🔒</div>
                          <p className="text-brand font-bold text-lg mb-2">Too early to go live</p>
                          <p className="text-text-secondary text-sm">
                            Scheduled for <span className="text-white font-semibold">{new Date(stream.scheduled_start_time).toLocaleString()}</span>
                          </p>
                          <p className="text-text-muted text-xs mt-2">You can go live within 10 minutes of the scheduled time.</p>
                        </>
                      ) : (
                        <>
                          <div className="text-5xl mb-4 opacity-60">🎥</div>
                          {stream?.scheduled_start_time && (
                            <p className="text-brand text-sm font-semibold mb-2">
                              Scheduled for {new Date(stream.scheduled_start_time).toLocaleString()}
                            </p>
                          )}
                          <p className="text-text-muted text-sm">Choose a source below to start broadcasting</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {isStreaming && (
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                    </span>
                    <span className="bg-black/80 backdrop-blur-sm text-white text-xs font-mono px-2 py-0.5 rounded-full border border-white/10">
                      {formatTime(duration)}
                    </span>
                  </div>
                )}
              </div>
            ) : stream?.scheduled_start_time && !isLive ? (
              <div className="relative w-full aspect-video bg-[#0a0a0a] flex flex-col items-center justify-center text-center p-8">
                {stream.thumbnail_url && (
                  <img src={stream.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
                )}
                <div className="relative z-10">
                  <div className="text-6xl mb-5 opacity-70">⏳</div>
                  <h2 className="text-2xl font-bold text-white mb-2">Coming Soon</h2>
                  <p className="text-brand font-semibold">
                    {new Date(stream.scheduled_start_time).toLocaleString(undefined, {
                      weekday: 'long', month: 'long', day: 'numeric',
                      hour: 'numeric', minute: '2-digit'
                    })}
                  </p>
                  <p className="text-text-muted text-sm mt-4 max-w-xs">
                    The stream will begin automatically when the broadcaster goes live.
                  </p>
                </div>
              </div>
            ) : stream?.recording_url && !isLive ? (
              <div className="relative w-full aspect-video bg-black">
                <video 
                  src={stream.recording_url} 
                  controls 
                  className="w-full h-full object-contain bg-black"
                />
              </div>
            ) : (
              <VideoPlayer videoRef={remoteVideoRef} connectionState={connectionState} isLive={isLive} />
            )}
          </div>

          {/* Below-video info */}
          <div className="px-4 lg:px-6 py-4 space-y-4 flex-1 overflow-y-auto">

            {/* Error banners */}
            {webrtcError && (
              <div className="bg-brand/10 border border-brand/30 text-red-300 text-sm px-4 py-2.5 rounded-lg">
                {webrtcError}
              </div>
            )}
            {isBroadcaster && pageError && (
              <div className="bg-brand/10 border border-brand/30 text-red-300 text-sm px-4 py-2.5 rounded-lg">
                {pageError}
              </div>
            )}

            {/* Stream title & meta */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {isLive ? (
                    <span className="flex items-center gap-1.5 bg-brand text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(229,9,20,0.5)]">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                    </span>
                  ) : (
                    <span className="bg-dark-hover text-text-muted text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                      Offline
                    </span>
                  )}
                  {stream?.category && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${catColor}`}>
                      {stream.category}
                    </span>
                  )}
                </div>

                <h1 className="text-white text-xl font-bold leading-tight">{stream?.title}</h1>

                <div className="flex items-center gap-2 mt-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-brand/30 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 border border-brand/20">
                    {stream?.avatar_url
                      ? <img src={stream.avatar_url} alt={stream.username} className="w-full h-full object-cover" />
                      : stream?.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <p className="text-text-secondary text-sm font-medium">{stream?.username}</p>
                </div>

                {stream?.description && (
                  <p className="text-text-muted text-sm mt-2 leading-relaxed line-clamp-2">{stream.description}</p>
                )}
              </div>

              {isLive && (
                <div className="flex-shrink-0 text-right">
                  <p className="text-2xl font-bold text-white">{viewerCount.toLocaleString()}</p>
                  <p className="text-text-muted text-xs">watching</p>
                </div>
              )}
            </div>

            {/* Broadcaster stats */}
            {isBroadcaster && isStreaming && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Duration', value: formatTime(duration), mono: true },
                  { label: 'Viewers',  value: viewerCount.toLocaleString() },
                  { label: 'Peak',     value: peakViewers.toLocaleString() },
                ].map(stat => (
                  <div key={stat.label} className="bg-dark-surface border border-dark-border rounded-xl p-3 text-center">
                    <p className="text-text-muted text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className={`text-white font-bold text-lg ${stat.mono ? 'font-mono' : ''}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Broadcaster controls */}
            {isBroadcaster && (
              isTooEarlyToStart ? (
                <div className="bg-dark-surface border border-dark-border rounded-xl p-5 text-center">
                  <p className="text-text-muted text-sm">🔒 Stream is locked until 10 minutes before the scheduled start.</p>
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
        </div>

        {/* ── Right: Chat panel ── */}
        <div className="w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 border-l border-dark-border/40 flex flex-col h-[50vh] lg:h-auto">
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