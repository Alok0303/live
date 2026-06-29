// SettingsPage.jsx
// Allows users to update their bio and avatar URL.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [bio,       setBio]       = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const res = await apiClient.patch('/users/me', {
        bio:        bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });

      // Update auth context with fresh user data so Navbar + Profile refresh
      updateUser(res.data.user);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Avatar preview — show initials if URL is invalid/empty
  const [imgError, setImgError] = useState(false);
  const showAvatar = avatarUrl && !imgError;

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(`/profile/${user?.username}`)}
          className="text-text-secondary hover:text-text-primary transition-colors text-sm"
        >
          ← Back to profile
        </button>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-1">Settings</h1>
      <p className="text-text-secondary text-sm mb-8">Update your profile information.</p>

      <div className="card">
        {/* Avatar preview */}
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-dark-border">
          <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold overflow-hidden flex-shrink-0">
            {showAvatar
              ? <img src={avatarUrl} alt={user?.username} className="w-full h-full object-cover" onError={() => setImgError(true)} />
              : user?.username?.[0]?.toUpperCase()
            }
          </div>
          <div>
            <p className="text-text-primary font-semibold">{user?.username}</p>
            <p className="text-text-muted text-xs mt-0.5">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-900/30 border border-green-700 text-green-400 text-sm px-3 py-2 rounded-md">
              ✓ Changes saved successfully!
            </div>
          )}

          {/* Avatar URL */}
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={e => { setAvatarUrl(e.target.value); setImgError(false); }}
              placeholder="https://example.com/your-photo.jpg"
              className="input-field"
            />
            <p className="text-text-muted text-xs mt-1">Paste a direct link to any image.</p>
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-text-secondary text-sm">Bio</label>
              <span className={`text-xs ${bio.length > 270 ? 'text-yellow-500' : 'text-text-muted'}`}>
                {bio.length}/300
              </span>
            </div>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell the world a bit about yourself..."
              className="input-field resize-none"
              rows={4}
              maxLength={300}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate(`/profile/${user?.username}`)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
