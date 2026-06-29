function getInitial(username) {
  return username ? username[0].toUpperCase() : '?';
}

function getUserColor(username) {
  const colors = [
    'bg-purple-600', 'bg-blue-600', 'bg-green-600',
    'bg-yellow-600', 'bg-red-600',  'bg-pink-600',
    'bg-indigo-600', 'bg-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ChatMessage({ message }) {
  const { username, avatar_url, content } = message;
  const colorClass = getUserColor(username || '?');

  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0">
        {avatar_url ? (
          <img src={avatar_url} alt={username} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className={`w-6 h-6 rounded-full ${colorClass} flex items-center justify-center`}>
            <span className="text-white text-xs font-bold">{getInitial(username)}</span>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <span className="text-brand-purple text-xs font-semibold mr-1.5">{username}</span>
        <span className="text-text-secondary text-sm break-words">{content}</span>
      </div>
    </div>
  );
}