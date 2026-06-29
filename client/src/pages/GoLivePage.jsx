// GoLivePage.jsx
// Where a logged-in user sets up and starts their stream.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

const TITLE_MAX    = 100;
const DESC_MAX     = 300;

export default function GoLivePage() {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState('Just Chatting');
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch available categories from server
  useEffect(() => {
    apiClient.get('/streams/categories')
      .then(res => setCategories(res.data.categories))
      .catch(() => setCategories(['Just Chatting', 'Gaming', 'Music', 'Art', 'IRL', 'Science & Technology', 'Sports']));
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a stream title');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Create the stream record in DB
      const res = await apiClient.post('/streams', {
        title:       title.trim(),
        description: description.trim(),
        category,
      });
      const { stream_key } = res.data.stream;

      // Navigate to the streamer view with this stream key
      navigate(`/stream/${stream_key}?mode=broadcast`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create stream');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-text-primary mb-1">Go Live</h1>
      <p className="text-text-secondary text-sm mb-8">
        Set up your stream and start broadcasting to viewers.
      </p>

      <div className="card">
        <form onSubmit={handleStart} className="flex flex-col gap-5">
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          {/* Stream title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-text-secondary text-sm">Stream title *</label>
              <span className={`text-xs ${title.length > TITLE_MAX * 0.9 ? 'text-yellow-500' : 'text-text-muted'}`}>
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              placeholder="What are you streaming today?"
              className="input-field"
              maxLength={TITLE_MAX}
              autoFocus
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="input-field bg-dark-surface appearance-none cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-text-secondary text-sm">Description</label>
              <span className={`text-xs ${description.length > DESC_MAX * 0.9 ? 'text-yellow-500' : 'text-text-muted'}`}>
                {description.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell viewers what you'll be doing..."
              className="input-field resize-none"
              rows={3}
              maxLength={DESC_MAX}
            />
          </div>

          {/* Streamer info */}
          <div className="flex items-center gap-3 bg-dark-base rounded-md p-3">
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                : user.username[0].toUpperCase()
              }
            </div>
            <div>
              <p className="text-text-primary text-sm font-medium">{user.username}</p>
              <p className="text-text-muted text-xs">Streaming as yourself</p>
            </div>
          </div>

          {/* Info box */}
          <div className="text-xs text-text-muted bg-dark-base rounded-md p-3 space-y-1">
            <p>• Your webcam or screen will be shared with viewers</p>
            <p>• Viewers can join and chat in real time</p>
            <p>• You control when to start and stop</p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Setting up...' : '🎥 Start Stream'}
          </button>
        </form>
      </div>
    </div>
  );
}