// ProfilePage.jsx

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    apiClient.get(`/users/${username}`)
      .then(res => {
        setProfile(res.data.user);
        setStreams(res.data.streams);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <LoadingSpinner size="lg" />;

  if (!profile) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <p className="text-text-secondary">User not found.</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="card mb-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 overflow-hidden">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            : profile.username[0].toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-text-primary">{profile.username}</h1>
            {isOwnProfile && (
              <Link to="/settings" className="btn-secondary text-xs py-1 px-3">
                Edit Profile
              </Link>
            )}
          </div>
          <p className="text-text-secondary text-sm mt-1">
            {profile.bio || 'No bio yet.'}
          </p>
          <p className="text-text-muted text-xs mt-2">
            Joined {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Recent streams */}
      <h2 className="text-text-primary font-semibold mb-3">Recent Streams</h2>

      {streams.length === 0 ? (
        <div className="card text-center py-8 text-text-muted text-sm">
          No streams yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {streams.map(stream => (
            <Link
              key={stream.id}
              to={`/stream/${stream.stream_key}`}
              className="card flex items-center justify-between gap-4 hover:border-brand transition-colors"
            >
              <div className="min-w-0">
                <p className="text-text-primary text-sm font-medium truncate">{stream.title}</p>
                <p className="text-text-muted text-xs mt-0.5">
                  {stream.started_at
                    ? new Date(stream.started_at).toLocaleString()
                    : 'Never went live'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {stream.is_live
                  ? <span className="live-badge">● Live</span>
                  : <span className="text-text-muted text-xs">Ended</span>
                }
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}