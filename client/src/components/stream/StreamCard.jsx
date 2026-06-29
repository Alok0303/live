// StreamCard.jsx
// Displays a single live stream in the homepage grid.

import { Link } from 'react-router-dom';

export default function StreamCard({ stream }) {
  return (
    <Link
      to={`/stream/${stream.stream_key}`}
      className="group block bg-dark-surface border border-dark-border rounded-lg overflow-hidden hover:border-brand transition-colors duration-200"
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-dark-base flex items-center justify-center">
        {stream.thumbnail_url ? (
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Placeholder when no thumbnail */
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <span className="text-4xl">🎥</span>
            <span className="text-xs">Live</span>
          </div>
        )}

        {/* Live badge — top left */}
        <div className="absolute top-2 left-2">
          <span className="live-badge">● Live</span>
        </div>

        {/* Viewer count — bottom left */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
          👁 {stream.viewer_count} viewers
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

        <div className="min-w-0">
          {/* Stream title — truncate if long */}
          <p className="text-text-primary text-sm font-medium truncate group-hover:text-brand transition-colors">
            {stream.title}
          </p>
          <p className="text-text-secondary text-xs mt-0.5">{stream.username}</p>
        </div>
      </div>
    </Link>
  );
}