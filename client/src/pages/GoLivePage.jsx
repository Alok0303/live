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
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);

  // Minimum allowed schedule time: at least 1 day from now
  const minScheduleTime = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 16); // format as "YYYY-MM-DDTHH:MM"
  
  // Maximum allowed schedule time: at most 1 month (30 days) from now
  const maxScheduleTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 16);

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

    // Validate scheduled time: must be at least 24 hours from now
    if (isScheduled) {
      if (!scheduledTime) {
        setError('Please pick a date and time for your scheduled stream.');
        return;
      }
      const chosen = new Date(scheduledTime);
      const minAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const maxAllowed = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (chosen < minAllowed) {
        setError('Scheduled time must be at least 24 hours from now.');
        return;
      }
      if (chosen > maxAllowed) {
        setError('Scheduled time cannot be more than 1 month from now.');
        return;
      }
    }

    // Validate price removed (paid streams disabled)

    setLoading(true);
    setError('');

    try {
      let uploadedThumbnailUrl = null;
      if (thumbnailFile) {
        const formData = new FormData();
        formData.append('thumbnail', thumbnailFile);
        const uploadRes = await apiClient.post('/streams/upload-thumbnail', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedThumbnailUrl = uploadRes.data.url;
      }

      // Create the stream record in DB
      const res = await apiClient.post('/streams', {
        title:       title.trim(),
        description: description.trim(),
        category,
        scheduledStartTime: isScheduled ? new Date(scheduledTime).toISOString() : null,
        thumbnailUrl: uploadedThumbnailUrl
      });
      const { stream_key } = res.data.stream;

      if (isScheduled) {
        navigate('/'); // Go back home if scheduled
      } else {
        // Navigate to the streamer view with this stream key
        navigate(`/stream/${stream_key}?mode=broadcast`);
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.existingStream) {
        // User already has a live stream (e.g. from a stale/forgotten session) —
        // resume it instead of just showing an error.
        navigate(`/stream/${err.response.data.existingStream.stream_key}?mode=broadcast`);
        return;
      }
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

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Stream Thumbnail</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setThumbnailFile(e.target.files[0])}
              className="input-field cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-brand-light"
            />
            <p className="text-xs text-text-muted mt-1">If no image is provided, we'll pick a cute dog for you!</p>
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

          {/* Settings — Scheduling only */}
          <div className="bg-dark-base rounded-md p-4">
            <label className="flex items-center gap-2 text-text-primary text-sm mb-3 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={e => setIsScheduled(e.target.checked)}
                className="accent-brand w-4 h-4"
              />
              Schedule for later
            </label>
            {isScheduled && (
              <div className="mt-2">
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  min={minScheduleTime}
                  max={maxScheduleTime}
                  onChange={e => {
                    setScheduledTime(e.target.value);
                    setError('');
                  }}
                  className="input-field text-sm bg-dark-surface"
                  required
                />
                <p className="text-xs text-text-muted mt-1">
                  Must be between <span className="text-yellow-400 font-medium">24 hours</span> and <span className="text-yellow-400 font-medium">1 month</span> from now.
                </p>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="text-xs text-text-muted bg-dark-base rounded-md p-3 space-y-1">
            <p>• Your webcam or screen will be shared with viewers</p>
            <p>• Viewers can join and chat in real time</p>
            <p>• You control when to start and stop</p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm font-bold tracking-wide">
            {loading ? 'Setting up...' : (isScheduled ? '📅 Schedule Stream' : '🎥 Go Live Now')}
          </button>
        </form>
      </div>
    </div>
  );
}