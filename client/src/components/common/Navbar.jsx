// Navbar.jsx
// Top navigation bar shown on every page.

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-dark-surface border-b border-dark-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">▶</span>
          </div>
          <span className="font-bold text-text-primary text-base hidden sm:block">LiveStream</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Go Live button */}
              <Link
                to="/go-live"
                className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Go Live
              </Link>

              {/* User menu */}
              <div className="flex items-center gap-2">
                <Link
                  to={`/profile/${user.username}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {/* Avatar — initials if no image */}
                  <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : user.username[0].toUpperCase()
                    }
                  </div>
                  <span className="text-text-primary text-sm hidden sm:block">{user.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="text-text-secondary hover:text-text-primary text-sm transition-colors ml-1"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary text-sm py-1.5 px-3">
                Log in
              </Link>
              <Link to="/register" className="btn-primary text-sm py-1.5 px-3">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}