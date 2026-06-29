// ProfilePage.jsx

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

// Color-coded category badge
const CATEGORY_COLORS = {
  'Gaming':               'bg-blue-900/60 text-blue-300',
  'Music':                'bg-pink-900/60 text-pink-300',
  'Art':                  'bg-orange-900/60 text-orange-300',
  'IRL':                  'bg-green-900/60 text-green-300',
  'Science & Technology': 'bg-cyan-900/60 text-cyan-300',
  'Sports':               'bg-yellow-900/60 text-yellow-300',
  'Cooking':              'bg-red-900/60 text-red-300',
  'Travel':               'bg-teal-900/60 text-teal-300',
  'Education':            'bg-purple-900/60 text-purple-300',
  'Just Chatting':        'bg-gray-700/60 text-gray-300',
};

function formatDuration(start, end) {
  if (!start) return null;
  const endTime = end ? new Date(end) : new Date();
  const ms = endTime - new Date(start);
  if (ms < 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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

  const totalStreams  = streams.length;
  const liveNow      = streams.filter(s => s.is_live).length;
  const totalViewers = streams.reduce((sum, s) => sum + (s.peak_viewer_count || s.viewer_count || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="card mb-6">
        <div className="flex items-start gap-5">
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

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-dark-border text-center">
          <div>
            <p className="text-text-primary text-lg font-bold">{totalStreams}</p>
            <p className="text-text-muted text-xs">Streams</p>
          </div>
          <div>
            <p className="text-text-primary text-lg font-bold">{liveNow > 0 ? <span className="text-red-400">{liveNow} Live</span> : 0}</p>
            <p className="text-text-muted text-xs">Live Now</p>
          </div>
          <div>
            <p className="text-text-primary text-lg font-bold">{totalViewers.toLocaleString()}</p>
            <p className="text-text-muted text-xs">Peak Viewers</p>
          </div>
        </div>
      </div>

      {/* Recent streams */}
      <h2 className="text-text-primary font-semibold mb-3">Recent Streams</h2>

      {streams.length === 0 ? (
        <div className="card text-center py-8 text-text-muted text-sm">
          No streams yet.
          {isOwnProfile && (
            <div className="mt-3">
              <Link to="/go-live" className="btn-primary text-sm">Go Live Now</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {streams.map(stream => {
            const dur = formatDuration(stream.started_at, stream.ended_at);
            const catColor = CATEGORY_COLORS[stream.category] || CATEGORY_COLORS['Just Chatting'];
            return (
              <Link
                key={stream.id}
                to={`/stream/${stream.stream_key}`}
                className="card flex items-center justify-between gap-4 hover:border-brand transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-text-primary text-sm font-medium truncate group-hover:text-brand transition-colors">
                      {stream.title}
                    </p>
                    {stream.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${catColor}`}>
                        {stream.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-text-muted text-xs">
                    <span>
                      {stream.started_at
                        ? new Date(stream.started_at).toLocaleString()
                        : 'Never went live'}
                    </span>
                    {dur && <span>· {dur}</span>}
                    {(stream.peak_viewer_count || stream.viewer_count) > 0 && (
                      <span>· 👁 {(stream.peak_viewer_count || stream.viewer_count).toLocaleString()} peak</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {stream.is_live
                    ? <span className="live-badge">● Live</span>
                    : <span className="text-text-muted text-xs">Ended</span>
                  }
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}