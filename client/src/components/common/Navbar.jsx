// Navbar.jsx — Premium Netflix-style top navigation

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

  // Transparent at top → solid on scroll (exactly like Netflix)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown when navigating
  useEffect(() => { setProfileOpen(false); }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-dark-base/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.8)]'
          : 'bg-gradient-to-b from-black/90 to-transparent'
      }`}
    >
      <div className="px-6 lg:px-12 h-16 flex items-center justify-between">

        {/* ── Logo ── */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
            <span
              className="text-brand font-black tracking-tighter select-none"
              style={{ fontSize: '1.65rem', letterSpacing: '-0.04em', fontFamily: 'Georgia, serif' }}
            >
              STREAMFLIX
            </span>
          </Link>

          {/* Nav links (desktop) */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="text-white hover:text-text-secondary transition-colors duration-150">Home</Link>
            {isAuthenticated && (
              <>
                <Link to={`/profile/${user.username}`} className="text-text-secondary hover:text-white transition-colors duration-150">My Channel</Link>
                <Link to="/go-live" className="text-text-secondary hover:text-white transition-colors duration-150">Go Live</Link>
              </>
            )}
          </div>
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-4">

          {isAuthenticated ? (
            <>
              {/* Live status pill */}
              {isStreaming ? (
                <Link
                  to={`/stream/${activeStreamKey}?mode=broadcast`}
                  className="flex items-center gap-1.5 bg-brand text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse shadow-[0_0_12px_rgba(229,9,20,0.6)]"
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  LIVE
                </Link>
              ) : (
                <Link
                  to="/go-live"
                  className="hidden sm:flex items-center gap-1.5 bg-brand hover:bg-brand-light text-white text-xs font-bold px-4 py-2 rounded transition-all duration-150 shadow-[0_0_10px_rgba(229,9,20,0.3)] hover:shadow-[0_0_16px_rgba(229,9,20,0.6)]"
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Go Live
                </Link>
              )}

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center gap-2 group"
                >
                  <div className="w-8 h-8 rounded overflow-hidden border-2 border-transparent group-hover:border-white transition-all duration-150 bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : user.username[0].toUpperCase()
                    }
                  </div>
                  {/* Caret */}
                  <svg
                    className={`w-3 h-3 text-white transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                    fill="currentColor" viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Dropdown */}
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-dark-base border border-dark-border rounded shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-dark-border">
                      <p className="text-white text-sm font-semibold truncate">{user.username}</p>
                      <p className="text-text-muted text-xs truncate">{user.email}</p>
                    </div>
                    <Link
                      to={`/profile/${user.username}`}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-text-secondary hover:text-white hover:bg-dark-hover transition-colors"
                    >
                      <span>👤</span> My Channel
                    </Link>
                    <Link
                      to="/go-live"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-text-secondary hover:text-white hover:bg-dark-hover transition-colors"
                    >
                      <span>🎥</span> Go Live
                    </Link>
                    <div className="border-t border-dark-border">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-secondary hover:text-brand hover:bg-dark-hover transition-colors text-left"
                      >
                        <span>🚪</span> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm text-white font-medium hover:text-text-secondary transition-colors hidden sm:block"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-brand hover:bg-brand-light text-white text-sm font-bold px-4 py-2 rounded transition-all duration-150 shadow-[0_0_10px_rgba(229,9,20,0.3)]"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}