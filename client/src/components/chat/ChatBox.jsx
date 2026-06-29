import ChatMessage from './ChatMessage';

export default function ChatBox({
  messages, inputText, setInputText,
  sendMessage, handleKeyDown, error, bottomRef, user,
}) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg flex flex-col" style={{ height: '500px' }}>
      
      {/* Header */}
      <div className="p-3 border-b border-dark-border flex-shrink-0">
        <h2 className="text-text-primary font-semibold text-sm">Stream Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-text-muted text-xs text-center mt-4">No messages yet. Say hello! 👋</p>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1 text-xs text-red-400 bg-red-900/20 flex-shrink-0">{error}</div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-dark-border flex-shrink-0">
        {user ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              maxLength={500}
              className="flex-1 bg-dark-base border border-dark-border rounded-md px-3 py-2
                         text-sm text-text-primary placeholder-text-muted
                         focus:outline-none focus:border-brand-purple transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim()}
              className="btn-primary text-sm px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        ) : (
          <p className="text-text-muted text-xs text-center">
            <a href="/login" className="text-brand-purple hover:underline">Log in</a> to chat
          </p>
        )}
      </div>
    </div>
  );
}