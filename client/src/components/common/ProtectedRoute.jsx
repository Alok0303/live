// ProtectedRoute.jsx
// Wraps routes that require login.
// If not logged in, redirects to /login automatically.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Wait for auth check to finish before deciding
  if (loading) return <LoadingSpinner size="lg" />;

  if (!isAuthenticated) {
    // Save where they tried to go so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}