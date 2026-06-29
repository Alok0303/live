// HomePage.jsx
// Shows all currently live streams with real-time updates and category filtering.

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import StreamCard from '../components/stream/StreamCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const SORT_OPTIONS = [
  { label: 'Most Viewers', value: 'viewers' },
  { label: 'Newest',       value: 'newest'  },
];

export default function HomePage() {
  const [streams,      setStreams]      = useState([]);
  const [categories,   setCategories]  = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort,         setSort]         = useState('viewers');
  const [loading,      setLoading]      = useState(true);

  const { isAuthenticated } = useAuth();
  const socket = useSocket();

  // Fetch helper — can filter by category
  const fetchStreams = useCallback((cat = activeCategory) => {
    const params = cat && cat !== 'All' ? `?category=${encodeURIComponent(cat)}` : '';
    return apiClient.get(`/streams${params}`)
      .then(res => setStreams(res.data.streams))
      .catch(err => console.error('Failed to fetch streams:', err));
  }, [activeCategory]);

  // Initial load + poll every 30s as a safety net
  useEffect(() => {
    setLoading(true);
    fetchStreams().finally(() => setLoading(false));

    const interval = setInterval(() => fetchStreams(), 30000);
    return () => clearInterval(interval);
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch categories once
  useEffect(() => {
    apiClient.get('/streams/categories')
      .then(res => setCategories(['All', ...res.data.categories]))
      .catch(() => setCategories(['All']));
  }, []);

  // ─── Real-time socket updates ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Join lobby to receive push events
    socket.emit('lobby:join');

    // A viewer joined/left a stream → update its count in-place
    const onViewerUpdate = ({ streamKey, count }) => {
      setStreams(prev =>
        prev.map(s => s.stream_key === streamKey ? { ...s, viewer_count: count } : s)
      );
    };

    // A new stream went live → re-fetch the list so it appears
    const onWentLive = () => {
      fetchStreams();
    };

    // A stream ended → remove it from the list instantly
    const onWentOffline = ({ streamKey }) => {
      setStreams(prev => prev.filter(s => s.stream_key !== streamKey));
    };

    socket.on('stream:viewer_update', onViewerUpdate);
    socket.on('stream:went_live',     onWentLive);
    socket.on('stream:went_offline',  onWentOffline);

    return () => {
      socket.emit('lobby:leave');
      socket.off('stream:viewer_update', onViewerUpdate);
      socket.off('stream:went_live',     onWentLive);
      socket.off('stream:went_offline',  onWentOffline);
    };
  }, [socket, fetchStreams]);

  // Client-side sort
  const sorted = [...streams].sort((a, b) => {
    if (sort === 'viewers') return (b.viewer_count ?? 0) - (a.viewer_count ?? 0);
    return new Date(b.started_at) - new Date(a.started_at);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Live Channels</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {loading ? '...' : `${streams.length} stream${streams.length !== 1 ? 's' : ''} live`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort selector */}
          {streams.length > 1 && (
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="bg-dark-surface border border-dark-border text-text-secondary text-xs
                         rounded-md px-2 py-1.5 focus:outline-none focus:border-brand cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {isAuthenticated && (
            <Link to="/go-live" className="btn-primary text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Go Live
            </Link>
          )}
        </div>
      </div>

      {/* Category filter tabs */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 ${
                activeCategory === cat
                  ? 'bg-brand text-white'
                  : 'bg-dark-surface border border-dark-border text-text-secondary hover:border-brand hover:text-text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner size="lg" />
      ) : sorted.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4">📺</div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            {activeCategory !== 'All' ? `No ${activeCategory} streams live` : 'No streams live right now'}
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            {activeCategory !== 'All'
              ? <button onClick={() => setActiveCategory('All')} className="text-brand hover:underline">See all streams</button>
              : 'Be the first one to go live!'
            }
          </p>
          {isAuthenticated ? (
            <Link to="/go-live" className="btn-primary">Start Streaming</Link>
          ) : (
            <Link to="/register" className="btn-primary">Sign up to stream</Link>
          )}
        </div>
      ) : (
        /* Stream grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(stream => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      )}
    </div>
  );
}