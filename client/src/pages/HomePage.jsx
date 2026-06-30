// HomePage.jsx
// Netflix-style homepage with horizontal category rows, Top 10, and fancy empty states.

import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/apiClient';
import StreamCard from '../components/stream/StreamCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useBroadcast } from '../context/BroadcastContext';

// All possible categories — always show a row for each
const ALL_CATEGORIES = [
  'Just Chatting', 'Gaming', 'Music', 'Art', 'IRL',
  'Science & Technology', 'Sports', 'Cooking', 'Travel', 'Education',
];

// Fancy empty-state messages per category
const EMPTY_MESSAGES = {
  'Just Chatting':        { emoji: '💬', text: 'The lounge is quiet... for now.',   sub: 'No one is chatting live. Be the voice of the internet!' },
  'Gaming':               { emoji: '🎮', text: 'No players in the arena.',            sub: 'The leaderboard is empty. Start a stream and claim your throne!' },
  'Music':                { emoji: '🎵', text: 'The stage is empty.',                 sub: 'Drop a beat. The crowd is waiting for you!' },
  'Art':                  { emoji: '🎨', text: 'The canvas is blank.',                sub: 'No artists live right now. Inspire the world with your work!' },
  'IRL':                  { emoji: '🌍', text: 'No adventures happening live.',       sub: 'Get out there and show us your world!' },
  'Science & Technology': { emoji: '🔬', text: 'The lab is dark.',                   sub: 'No tech streams live. Fire up the experiments!' },
  'Sports':               { emoji: '🏆', text: 'No games on the field.',              sub: 'The stadium is empty. Show us what you\'ve got!' },
  'Cooking':              { emoji: '🍳', text: 'The kitchen is cold.',                sub: 'No chefs live right now. Fire up the stove!' },
  'Travel':               { emoji: '✈️', text: 'No explorers on the road.',          sub: 'The world is huge. Start exploring and bring us along!' },
  'Education':            { emoji: '📚', text: 'Class is out.',                       sub: 'No educators live right now. Share your knowledge!' },
};

function CategoryEmptyState({ category }) {
  const msg = EMPTY_MESSAGES[category] || { emoji: '📡', text: `No ${category} streams live.`, sub: 'Check back later or be the first to go live!' };
  return (
    <div className="flex items-center gap-6 px-4 py-6 ml-2 rounded-lg bg-dark-surface/50 border border-dashed border-dark-border min-w-[340px] max-w-lg">
      <span className="text-5xl opacity-60">{msg.emoji}</span>
      <div>
        <p className="text-text-primary font-semibold text-sm">{msg.text}</p>
        <p className="text-text-muted text-xs mt-1">{msg.sub}</p>
      </div>
    </div>
  );
}

// Netflix-style Top 10 number badge
function Top10Card({ stream, rank }) {
  return (
    <div className="flex-shrink-0 w-[85vw] sm:w-[280px] md:w-[310px] snap-start relative">
      {/* Big rank number behind card */}
      <div
        className="absolute -left-4 bottom-0 z-0 select-none pointer-events-none"
        style={{
          fontSize: '9rem',
          fontWeight: 900,
          lineHeight: 1,
          color: 'transparent',
          WebkitTextStroke: '2px rgba(229,9,20,0.55)',
          fontFamily: 'serif',
        }}
      >
        {rank}
      </div>
      <div className="relative z-10 ml-8">
        <StreamCard stream={stream} />
      </div>
    </div>
  );
}

function CategoryRow({ title, streams, emptyCategory, icon }) {
  return (
    <section>
      <h2 className="text-lg md:text-xl font-bold text-white mb-3 px-2 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      <div className="flex overflow-x-auto gap-4 pb-4 pt-1 px-2 row-scroll snap-x">
        {streams.length > 0 ? (
          streams.map(stream => (
            <div key={stream.id} className="w-[85vw] sm:w-[320px] md:w-[350px] flex-shrink-0 snap-start">
              <StreamCard stream={stream} />
            </div>
          ))
        ) : (
          <CategoryEmptyState category={emptyCategory || title} />
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, user } = useAuth();
  const socket = useSocket();
  const { isStreaming, activeStreamKey } = useBroadcast();

  const fetchStreams = useCallback(() => {
    return apiClient.get('/streams')
      .then(res => setStreams(res.data.streams))
      .catch(err => console.error('Failed to fetch streams:', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStreams().finally(() => setLoading(false));
    const interval = setInterval(fetchStreams, 30000);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('lobby:join');

    const onViewerUpdate = ({ streamKey, count }) =>
      setStreams(prev => prev.map(s => s.stream_key === streamKey ? { ...s, viewer_count: count } : s));
    const onWentLive = () => fetchStreams();
    const onWentOffline = ({ streamKey }) =>
      setStreams(prev => prev.filter(s => s.stream_key !== streamKey));

    socket.on('stream:viewer_update', onViewerUpdate);
    socket.on('stream:went_live', onWentLive);
    socket.on('stream:went_offline', onWentOffline);

    return () => {
      socket.emit('lobby:leave');
      socket.off('stream:viewer_update', onViewerUpdate);
      socket.off('stream:went_live', onWentLive);
      socket.off('stream:went_offline', onWentOffline);
    };
  }, [socket, fetchStreams]);

  const displayableStreams = useMemo(() =>
    streams.filter(s => !(isAuthenticated && user && s.user_id === user.id)),
    [streams, isAuthenticated, user]
  );

  const liveStreams = useMemo(() =>
    displayableStreams
      .filter(s => !s.scheduled_start_time)
      .sort((a, b) => (b.viewer_count ?? 0) - (a.viewer_count ?? 0)),
    [displayableStreams]
  );

  const upcomingStreams = useMemo(() =>
    displayableStreams
      .filter(s => s.scheduled_start_time)
      .sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time)),
    [displayableStreams]
  );

  // Top 10: all live streams sorted by viewers, capped at 10
  const top10 = liveStreams.slice(0, 10);

  // Build category map from live streams
  const categoryMap = useMemo(() => {
    const map = {};
    liveStreams.forEach(s => {
      const cat = s.category || 'Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });
    return map;
  }, [liveStreams]);

  // Split categories: ones with live streams first, empty ones at the bottom
  const populatedCats = ALL_CATEGORIES.filter(cat => (categoryMap[cat] || []).length > 0);
  const emptyCats = ALL_CATEGORIES.filter(cat => (categoryMap[cat] || []).length === 0);

  return (
    <div className="min-h-screen bg-dark-base text-text-primary overflow-x-hidden">

      {loading ? (
        <div className="pt-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="pb-24 pt-20 space-y-10 px-4 lg:px-10">

          {/* ── Top 10 Row ─────────────────────────────────────────── */}
          {top10.length > 0 ? (
            <section>
              <h2 className="text-lg md:text-xl font-bold text-white mb-3 px-2 flex items-center gap-2">
                <span className="text-brand">🏆</span> Top 10 Streams
              </h2>
              <div className="flex overflow-x-auto gap-6 pb-4 pt-1 px-2 row-scroll snap-x">
                {top10.map((stream, i) => (
                  <Top10Card key={stream.id} stream={stream} rank={i + 1} />
                ))}
              </div>
            </section>
          ) : (
            <section>
              <h2 className="text-lg md:text-xl font-bold text-white mb-3 px-2 flex items-center gap-2">
                <span className="text-brand">🏆</span> Top 10 Streams
              </h2>
              <div className="flex overflow-x-auto gap-4 pb-4 pt-1 px-2 row-scroll snap-x">
                <div className="flex items-center gap-6 px-6 py-6 rounded-lg bg-dark-surface/50 border border-dashed border-dark-border min-w-[360px]">
                  <span className="text-5xl opacity-60">🏆</span>
                  <div>
                    <p className="text-text-primary font-semibold text-sm">The leaderboard is empty.</p>
                    <p className="text-text-muted text-xs mt-1">No live streams yet. Start one and claim the #1 spot!</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Populated Category Rows (streams exist) ─────────────── */}
          {populatedCats.map(cat => (
            <CategoryRow
              key={cat}
              title={cat}
              streams={categoryMap[cat]}
              emptyCategory={cat}
            />
          ))}

          {/* ── Upcoming Premieres Row ──────────────────────────────── */}
          <section>
            <h2 className="text-lg md:text-xl font-bold text-white mb-3 px-2 flex items-center gap-2">
              <span className="text-brand">📅</span> Upcoming Premieres
            </h2>
            <div className="flex overflow-x-auto gap-4 pb-4 pt-1 px-2 row-scroll snap-x">
              {upcomingStreams.length > 0 ? (
                upcomingStreams.map(stream => (
                  <div key={stream.id} className="w-[85vw] sm:w-[320px] md:w-[350px] flex-shrink-0 snap-start">
                    <StreamCard stream={stream} />
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-6 px-6 py-6 rounded-lg bg-dark-surface/50 border border-dashed border-dark-border min-w-[360px]">
                  <span className="text-5xl opacity-60">📅</span>
                  <div>
                    <p className="text-text-primary font-semibold text-sm">Nothing scheduled yet.</p>
                    <p className="text-text-muted text-xs mt-1">Be the first to schedule a premiere and build the hype!</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Empty Category Rows (at bottom) ─────────────────────── */}
          {emptyCats.length > 0 && (
            <div className="space-y-10 border-t border-dark-border/40 pt-10">
              <p className="text-text-muted text-xs uppercase tracking-widest px-2">More Categories</p>
              {emptyCats.map(cat => (
                <CategoryRow
                  key={cat}
                  title={cat}
                  streams={[]}
                  emptyCategory={cat}
                />
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}