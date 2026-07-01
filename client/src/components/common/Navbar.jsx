// Navbar.jsx — Punchline-style top navigation

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBroadcast } from '../../context/BroadcastContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isStreaming, activeStreamKey } = useBroadcast();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setProfileOpen(false); }, [location]);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-dark-base/98 backdrop-blur shadow-[0_1px_0_rgba(255,255,255,0.06)]' : 'bg-dark-base'
    }`}>
      <div className="px-6 lg:px-10 h-14 flex items-center justify-between">

        {/* ── Logo ── */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            {/* Square amber logo mark */}
            <div className="w-7 h-7 bg-brand rounded flex items-center justify-center flex-shrink-0">
              <span className="text-black text-xs font-black">▶</span>
            </div>
            <span className="text-white font-black text-base tracking-tight uppercase">StreamLive</span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: 'Browse',     to: '/' },
              { label: 'Live Now',   to: '/?filter=live' },
              { label: 'Upcoming',   to: '/?filter=upcoming' },
              { label: 'Archive',    to: '/archive' },
              { label: 'Categories', to: '/categories' },
            ].map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className={`text-sm font-medium transition-colors duration-150 ${
                  location.pathname === to.split('?')[0] && !to.includes('?')
                    ? 'text-white'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Live pill */}
              {isStreaming ? (
                <Link
                  to={`/stream/${activeStreamKey}?mode=broadcast`}
                  className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded uppercase tracking-widest animate-pulse"
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  LIVE
                </Link>
              ) : (
                <Link
                  to="/go-live"
                  className="hidden sm:flex items-center gap-1.5 btn-primary text-xs"
                >
                  + Go Live
                </Link>
              )}

              {/* Profile */}
              <div className="relative">
                <button onClick={() => setProfileOpen(v => !v)} className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-dark-border group-hover:border-brand transition-colors bg-brand/20 flex items-center justify-center text-xs font-bold text-white">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : user.username[0].toUpperCase()
                    }
                  </div>
                  <svg className={`w-3 h-3 text-text-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-dark-card border border-dark-border rounded shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-dark-border">
                      <p className="text-white text-sm font-semibold truncate">{user.username}</p>
                    </div>
                    <Link to={`/profile/${user.username}`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-dark-hover transition-colors">
                      👤 My Channel
                    </Link>
                    <Link to="/go-live" className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-dark-hover transition-colors">
                      🎥 Go Live
                    </Link>
                    <div className="border-t border-dark-border">
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-dark-hover transition-colors text-left">
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-text-secondary hover:text-white transition-colors font-medium">
                Sign In
              </Link>
              <Link to="/register" className="btn-primary text-xs">
                Subscribe
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}