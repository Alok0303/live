// LoginPage.jsx

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/apiClient';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect back to where they came from, or home
  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/auth/login', form);
      login(res.data.user, res.data.token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl">▶</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome back</h1>
          <p className="text-text-secondary text-sm mt-1">Log in to your account</p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-text-secondary text-sm mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input-field"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1.5">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="text-center text-text-secondary text-sm mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand hover:text-brand-light transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}