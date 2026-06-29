// RegisterPage.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/apiClient';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/auth/register', form);
      login(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl">▶</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
          <p className="text-text-secondary text-sm mt-1">Start streaming today</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-text-secondary text-sm mb-1.5">Username</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="coolstreamer"
                className="input-field"
                required
                autoFocus
                minLength={3}
                maxLength={20}
              />
              <p className="text-text-muted text-xs mt-1">3–20 characters</p>
            </div>

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
                minLength={6}
              />
              <p className="text-text-muted text-xs mt-1">At least 6 characters</p>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-text-secondary text-sm mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:text-brand-light transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}