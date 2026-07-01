// HomePage.jsx — Punchline-style homepage

import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/apiClient';
import StreamCard from '../components/stream/StreamCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useBroadcast } from '../context/BroadcastContext';

// ─── Section Row ─────────────────────────────────────────────────────────────
function SectionRow({ icon, title, streams, emptyMsg, emptyIcon }) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 px-0">
        <div className="flex items-center gap-2">
          {icon && <span className="text-brand">{icon}</span>}
          <h2 className="text-white font-bold uppercase tracking-widest text-sm">{title}</h2>
        </div>
        {streams.length > 3 && (
          <button className="text-text-muted hover:text-white text-xs font-medium transition-colors flex items-center gap-1">
            See all <span className="text-lg leading-none">›</span>
          </button>
        )}
      </div>

      {streams.length > 0 ? (
        <div className="flex overflow-x-auto gap-4 pb-2 row-scroll snap-x -mx-0">
          {streams.map(stream => (
            <div key={stream.id} className="flex-shrink-0 w-[85vw] sm:w-[260px] md:w-[280px] snap-start">
              <StreamCard stream={stream} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-4 bg-dark-card border border-dark-border rounded-lg px-6 py-5">
          <span className="text-4xl opacity-40">{emptyIcon || '📺'}</span>
          <p className="text-text-muted text-sm">{emptyMsg || 'Nothing here yet.'}</p>
        </div>
      )}
    </section>
  );
}

// ─── Pricing Section ─────────────────────────────────────────────────────────
function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      desc: 'For casual viewers',
      features: ['Watch free live streams', 'Basic chat', 'HD quality'],
      cta: 'Get Started',
      href: '/register',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$9',
      period: '/month',
      desc: 'For dedicated fans',
      features: ['Everything in Starter', 'All live streams', 'No ads', 'Priority chat'],
      cta: 'Go Pro',
      href: '/register',
      highlight: true,
      badge: 'Most Popular',
    },
    {
      name: 'Creator',
      price: '$19',
      period: '/month',
      desc: 'For streamers',
      features: ['Everything in Pro', 'Go Live unlimited', 'Analytics dashboard', 'Custom channel page'],
      cta: 'Start Creating',
      href: '/go-live',
      highlight: false,
    },
  ];

  return (
    <section className="py-16 border-t border-dark-border/40 mt-8">
      <div className="text-center mb-12">
        <p className="text-brand text-xs font-bold uppercase tracking-widest mb-2">Pick the</p>
        <h2 className="text-white text-4xl font-black uppercase tracking-tight">Choose Your Plan</h2>
        <p className="text-text-muted text-sm mt-3 max-w-md mx-auto">
          Subscribe for all access, or stream for free. Cancel anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {plans.map(plan => (
          <div
            key={plan.name}
            className={`relative rounded-lg p-6 border transition-all duration-200 ${
              plan.highlight
                ? 'bg-dark-card border-brand shadow-[0_0_40px_rgba(255,184,0,0.15)]'
                : 'bg-dark-card border-dark-border'
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-brand text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  {plan.badge}
                </span>
              </div>
            )}
            <h3 className="text-white font-bold text-lg">{plan.name}</h3>
            <p className="text-text-muted text-xs mt-0.5 mb-4">{plan.desc}</p>
            <div className="flex items-end gap-1 mb-5">
              <span className="text-white text-3xl font-black">{plan.price}</span>
              {plan.period && <span className="text-text-muted text-sm mb-0.5">{plan.period}</span>}
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-text-secondary text-xs">
                  <span className="text-brand mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={plan.href}
              className={`block text-center py-2.5 rounded font-bold text-sm transition-all duration-150 ${
                plan.highlight
                  ? 'bg-brand hover:bg-brand-light text-black'
                  : 'bg-dark-hover hover:bg-white/10 text-white border border-dark-border'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-8 mt-10 flex-wrap">
        {['No contracts', 'Cancel anytime', 'Secure payments', 'Instant access'].map(t => (
          <div key={t} className="flex items-center gap-1.5 text-text-muted text-xs">
            <span className="text-brand">✓</span> {t}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [streams, setStreams] = useState([]);
  const [pastStreams, setPastStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, user } = useAuth();
  const socket = useSocket();
  const { isStreaming, activeStreamKey } = useBroadcast();

  const fetchStreams = useCallback(() => {
    return Promise.all([
      apiClient.get('/streams'),
      apiClient.get('/streams/past')
    ]).then(([liveRes, pastRes]) => {
      setStreams(liveRes.data.streams || []);
      setPastStreams(pastRes.data.streams || []);
    }).catch(err => console.error('Failed to fetch streams:', err));
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

  const displayable = useMemo(() =>
    streams.filter(s => !(isAuthenticated && user && s.user_id === user.id)),
    [streams, isAuthenticated, user]
  );

  const liveStreams = useMemo(() =>
    displayable.filter(s => !s.scheduled_start_time && s.is_live)
      .sort((a, b) => (b.viewer_count ?? 0) - (a.viewer_count ?? 0)),
    [displayable]
  );

  const upcomingStreams = useMemo(() =>
    displayable.filter(s => s.scheduled_start_time)
      .sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time)),
    [displayable]
  );

  // Hero = top live stream
  const heroStream = liveStreams[0] || upcomingStreams[0] || null;

  // Category map (only live)
  const ALL_CATEGORIES = ['Just Chatting','Gaming','Music','Art','IRL','Science & Technology','Sports','Cooking','Travel','Education'];
  const categoryMap = useMemo(() => {
    const m = {};
    liveStreams.forEach(s => {
      const cat = s.category || 'Other';
      if (!m[cat]) m[cat] = [];
      m[cat].push(s);
    });
    return m;
  }, [liveStreams]);

  const populatedCats = ALL_CATEGORIES.filter(c => categoryMap[c]?.length > 0);

  return (
    <div className="min-h-screen bg-dark-base text-text-primary">

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      {!loading && heroStream && (
        <div className="relative w-full" style={{ minHeight: '420px' }}>
          {/* Background image */}
          {heroStream.thumbnail_url ? (
            <div className="absolute inset-0">
              <img
                src={heroStream.thumbnail_url}
                alt={heroStream.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-base via-dark-base/30 to-transparent" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#111] to-dark-base" />
          )}

          {/* Hero content */}
          <div className="relative z-10 max-w-3xl px-6 lg:px-10 pt-28 pb-16">
            {/* Live badge */}
            {!heroStream.scheduled_start_time && (
              <div className="flex items-center gap-3 mb-3">
                <span className="live-badge flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                </span>
                <span className="text-text-secondary text-xs font-medium">
                  {heroStream.viewer_count?.toLocaleString() ?? 0} watching now
                </span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-white text-4xl md:text-5xl font-black leading-tight mb-3">
              {heroStream.title}
            </h1>

            {/* Subtitle */}
            <p className="text-text-secondary text-sm mb-2">
              {heroStream.username}
              {heroStream.category && ` · ${heroStream.category}`}
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-3 mt-6">
              <Link
                to={`/stream/${heroStream.stream_key}`}
                className="flex items-center gap-2 bg-brand hover:bg-brand-light text-black font-bold px-6 py-3 rounded transition-all hover:scale-105"
              >
                ▶ {heroStream.scheduled_start_time ? 'View Details' : 'Join Live'}
              </Link>
              <Link
                to={`/stream/${heroStream.stream_key}`}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded border border-white/20 transition-all"
              >
                More Info
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className={`relative z-20 px-6 lg:px-10 ${heroStream ? 'pt-8 mt-2' : 'pt-20'} pb-16`}>

        {loading ? (
          <div className="flex justify-center py-32">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Live Right Now */}
            <SectionRow
              icon="🔴"
              title="Live Right Now"
              streams={liveStreams}
              emptyIcon="📡"
              emptyMsg="No one is live right now. Be the first!"
            />

            {/* Upcoming Shows */}
            <SectionRow
              icon="📅"
              title="Upcoming Shows"
              streams={upcomingStreams}
              emptyIcon="📅"
              emptyMsg="Nothing scheduled yet. Plan your next stream!"
            />

            {/* Past Shows */}
            <SectionRow
              icon="🕒"
              title="Past Shows – Rent or Subscribe"
              streams={pastStreams}
              emptyIcon="🎬"
              emptyMsg="No past streams available."
            />

            {/* Category rows — only populated ones */}
            {populatedCats.map(cat => (
              <SectionRow
                key={cat}
                title={cat}
                streams={categoryMap[cat]}
                emptyIcon="🎬"
                emptyMsg={`No ${cat} streams live right now.`}
              />
            ))}

            {/* Pricing */}
            <PricingSection />
          </>
        )}
      </div>

      {/* ── Sticky bottom CTA (for non-authenticated) ─────────────────── */}
      {!isAuthenticated && (
        <div className="sticky bottom-0 z-40 bg-dark-card border-t border-dark-border/50">
          <div className="px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand/20 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-brand text-sm">🔒</span>
              </div>
              <div>
                <p className="text-white text-sm font-bold leading-none">Some streams require a subscription</p>
                <p className="text-text-muted text-xs mt-0.5">Sign up for full access to all live and upcoming shows.</p>
              </div>
            </div>
            <Link to="/register" className="btn-primary text-xs flex-shrink-0">
              Get Started →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}