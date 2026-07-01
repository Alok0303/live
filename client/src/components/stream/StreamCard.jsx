// StreamCard.jsx — Punchline-style stream card

import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function parseUTCTimestamp(ts) {
  if (!ts) return null;
  return new Date(ts.replace(' ', 'T') + 'Z');
}

function formatDuration(startedAt) {
  const date = parseUTCTimestamp(startedAt);
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  if (ms < 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function StreamCard({ stream, variant = 'default' }) {
  const { user } = useAuth();
  const duration = formatDuration(stream.started_at);
  const isOwnStream = user && user.id === stream.user_id;
  const streamUrl = isOwnStream
    ? `/stream/${stream.stream_key}?mode=broadcast`
    : `/stream/${stream.stream_key}`;
  const isUpcoming = !!stream.scheduled_start_time;
  const isLive = !isUpcoming && stream.is_live;

  return (
    <Link
      to={streamUrl}
      className="group block bg-dark-card rounded-lg overflow-hidden border border-dark-border/50
                 hover:border-dark-hover transition-all duration-200 hover:-translate-y-0.5
                 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-[#0d0d0d]">
        {stream.thumbnail_url ? (
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] flex items-center justify-center">
            <span className="text-3xl opacity-30">{isUpcoming ? '📅' : '🎥'}</span>
          </div>
        )}

        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isLive && (
            <span className="live-badge flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
            </span>
          )}
          {isUpcoming && (
            <span className="bg-brand text-black text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest">
              Upcoming
            </span>
          )}
        </div>

        {/* Duration top-right */}
        {duration && !isUpcoming && (
          <div className="absolute top-2 right-2">
            <span className="bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
              {duration}
            </span>
          </div>
        )}

        {/* Viewer count bottom-left */}
        {isLive && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/90 to-transparent">
            <p className="text-white text-[10px] font-semibold">
              {stream.viewer_count?.toLocaleString() ?? 0} watching now
            </p>
          </div>
        )}
        {isUpcoming && stream.scheduled_start_time && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/90 to-transparent">
            <p className="text-brand text-[10px] font-semibold">
              {new Date(stream.scheduled_start_time).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
              })}
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-white text-sm font-bold leading-tight line-clamp-1 group-hover:text-brand transition-colors">
          {stream.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-4 h-4 rounded-full overflow-hidden bg-dark-border flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white">
            {stream.avatar_url
              ? <img src={stream.avatar_url} alt={stream.username} className="w-full h-full object-cover" />
              : stream.username?.[0]?.toUpperCase()
            }
          </div>
          <p className="text-text-muted text-xs truncate">{stream.username}</p>
          {stream.category && (
            <>
              <span className="text-dark-border">·</span>
              <p className="text-text-muted text-xs truncate">{stream.category}</p>
            </>
          )}
        </div>

        {/* Join / View button */}
        <div className="mt-3">
          {isUpcoming ? (
            <span className="block text-center bg-brand hover:bg-brand-light text-black text-xs font-bold py-1.5 px-3 rounded transition-colors">
              View Details
            </span>
          ) : isLive ? (
            <span className="block text-center bg-brand hover:bg-brand-light text-black text-xs font-bold py-1.5 px-3 rounded transition-colors">
              ▶ Watch Live
            </span>
          ) : (
            <span className="block text-center bg-dark-hover text-text-secondary text-xs font-bold py-1.5 px-3 rounded">
              View
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}