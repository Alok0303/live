// StreamCard.jsx — Premium Netflix-style stream card

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

export default function StreamCard({ stream }) {
  const { user } = useAuth();
  const duration = formatDuration(stream.started_at);
  const catColor = CATEGORY_COLORS[stream.category] || CATEGORY_COLORS['Just Chatting'];
  const isOwnStream = user && user.id === stream.user_id;
  const streamUrl = isOwnStream
    ? `/stream/${stream.stream_key}?mode=broadcast`
    : `/stream/${stream.stream_key}`;

  const isUpcoming = !!stream.scheduled_start_time;

  return (
    <Link
      to={streamUrl}
      className="group block rounded-lg overflow-hidden bg-dark-surface border border-dark-border/60
                 transition-all duration-300 hover:scale-[1.04] hover:border-brand/50
                 hover:shadow-[0_0_0_1px_rgba(229,9,20,0.3),0_20px_60px_rgba(0,0,0,0.9)]
                 hover:z-10 relative cursor-pointer"
    >
      {/* ── Thumbnail ───────────────────────────────────────── */}
      <div className="relative aspect-video overflow-hidden bg-[#0d0d0d]">
        {stream.thumbnail_url ? (
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:brightness-75"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d0d] via-[#1a1a1a] to-[#111] flex flex-col items-center justify-center gap-2">
            <span className="text-4xl opacity-40 transition-transform duration-300 group-hover:scale-110 group-hover:opacity-60">
              {isUpcoming ? '📅' : '🎥'}
            </span>
          </div>
        )}

        {/* Dark gradient on hover to show info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* ── Top-left badge ── */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          {isUpcoming ? (
            <span className="flex items-center gap-1 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest">
              📅 Upcoming
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-[0_0_8px_rgba(229,9,20,0.6)]">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* ── Top-right: duration or scheduled date ── */}
        {(duration || isUpcoming) && (
          <div className="absolute top-2 right-2">
            <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10">
              {isUpcoming
                ? new Date(stream.scheduled_start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : duration
              }
            </span>
          </div>
        )}

        {/* ── Bottom: viewers (appear on hover) ── */}
        {!isUpcoming && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-brand">●</span>
            {stream.viewer_count?.toLocaleString() ?? 0} watching
          </div>
        )}
      </div>

      {/* ── Info bar ────────────────────────────────────────── */}
      <div className="px-3 py-2.5 flex gap-2.5 bg-dark-surface group-hover:bg-dark-hover transition-colors duration-300">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-dark-border border border-brand/20 flex items-center justify-center text-xs font-bold text-white mt-0.5">
          {stream.avatar_url
            ? <img src={stream.avatar_url} alt={stream.username} className="w-full h-full object-cover" />
            : stream.username?.[0]?.toUpperCase()
          }
        </div>

        <div className="min-w-0 flex-1">
          {/* Title */}
          <p className="text-text-primary text-sm font-semibold leading-tight truncate group-hover:text-white transition-colors">
            {stream.title}
          </p>
          {/* Username */}
          <p className="text-text-muted text-xs mt-0.5 truncate">{stream.username}</p>
          {/* Category pill */}
          {stream.category && (
            <span className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${catColor}`}>
              {stream.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}