// HomePage.jsx
// Shows all currently live streams.

import { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import StreamCard from '../components/stream/StreamCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Fetch live streams on mount
    apiClient.get('/streams')
      .then(res => setStreams(res.data.streams))
      .catch(err => console.error('Failed to fetch streams:', err))
      .finally(() => setLoading(false));

    // Refresh the list every 15 seconds
    const interval = setInterval(() => {
      apiClient.get('/streams')
        .then(res => setStreams(res.data.streams))
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Live Channels</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {loading ? '...' : `${streams.length} stream${streams.length !== 1 ? 's' : ''} live`}
          </p>
        </div>

        {isAuthenticated && (
          <Link to="/go-live" className="btn-primary text-sm flex items-center gap-1.5">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Go Live
          </Link>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner size="lg" />
      ) : streams.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4">📺</div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No streams live right now</h2>
          <p className="text-text-secondary text-sm mb-6">Be the first one to go live!</p>
          {isAuthenticated ? (
            <Link to="/go-live" className="btn-primary">Start Streaming</Link>
          ) : (
            <Link to="/register" className="btn-primary">Sign up to stream</Link>
          )}
        </div>
      ) : (
        /* Stream grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {streams.map(stream => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      )}
    </div>
  );
}