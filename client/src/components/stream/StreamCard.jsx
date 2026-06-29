// StreamCard.jsx
// Displays a single live stream in the homepage grid.

import { Link } from 'react-router-dom';

// Format how long a stream has been live (e.g. "2h 15m" or "45m")
function formatDuration(startedAt) {
  if (!startedAt) return null;
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins  = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Color-coded category badge
const CATEGORY_COLORS = {
  'Gaming':                 'bg-blue-900/60 text-blue-300',
  'Music':                  'bg-pink-900/60 text-pink-300',
  'Art':                    'bg-orange-900/60 text-orange-300',
  'IRL':                    'bg-green-900/60 text-green-300',
  'Science & Technology':   'bg-cyan-900/60 text-cyan-300',
  'Sports':                 'bg-yellow-900/60 text-yellow-300',
  'Cooking':                'bg-red-900/60 text-red-300',
  'Travel':                 'bg-teal-900/60 text-teal-300',
  'Education':              'bg-purple-900/60 text-purple-300',
  'Just Chatting':          'bg-gray-700/60 text-gray-300',
};

export default function StreamCard({ stream }) {
  const duration = formatDuration(stream.started_at);
  const catColor = CATEGORY_COLORS[stream.category] || CATEGORY_COLORS['Just Chatting'];

  return (
    <Link
      to={`/stream/${stream.stream_key}`}
      className="group block bg-dark-surface border border-dark-border rounded-lg overflow-hidden
                 hover:border-brand transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/10"
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-dark-base flex items-center justify-center overflow-hidden">
        {stream.thumbnail_url ? (
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          /* Gradient placeholder when no thumbnail */
          <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-dark-base to-dark-hover flex flex-col items-center justify-center gap-2 text-text-muted">
            <span className="text-4xl group-hover:scale-110 transition-transform duration-200">🎥</span>
            <span className="text-xs font-medium tracking-wide uppercase opacity-60">Live</span>
          </div>
        )}

        {/* Live badge — top left */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="live-badge flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
            Live
          </span>
          {duration && (
            <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
              {duration}
            </span>
          )}
        </div>

        {/* Viewer count — bottom left */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
          <span>👁</span>
          <span className="font-medium">{stream.viewer_count?.toLocaleString() ?? 0}</span>
        </div>
      </div>

      {/* Stream info */}
      <div className="p-3 flex gap-3">
        {/* Streamer avatar */}
        <div className="w-8 h-8 rounded-full bg-brand flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
          {stream.avatar_url
            ? <img src={stream.avatar_url} alt={stream.username} className="w-full h-full object-cover" />
            : stream.username[0].toUpperCase()
          }
        </div>

        <div className="min-w-0 flex-1">
          {/* Stream title — truncate if long */}
          <p className="text-text-primary text-sm font-medium truncate group-hover:text-brand transition-colors">
            {stream.title}
          </p>
          <p className="text-text-secondary text-xs mt-0.5">{stream.username}</p>
          {/* Category tag */}
          {stream.category && (
            <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded font-medium ${catColor}`}>
              {stream.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}