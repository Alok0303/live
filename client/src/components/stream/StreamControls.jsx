// StreamControls.jsx
// Mic/camera toggle and end stream button for the broadcaster.

export default function StreamControls({
  isStreaming,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onStartWebcam,
  onStartScreen,
  onEndStream,
}) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
      <p className="text-text-secondary text-xs font-medium uppercase tracking-wide mb-3">
        Broadcast Controls
      </p>

      {!isStreaming ? (
        /* Before streaming — show source picker */
        <div className="flex flex-col gap-2">
          <p className="text-text-muted text-xs mb-1">Choose your source:</p>
          <div className="flex gap-2">
            <button
              onClick={onStartWebcam}
              className="btn-primary flex-1 text-sm py-2"
            >
              📷 Webcam
            </button>
            <button
              onClick={onStartScreen}
              className="btn-secondary flex-1 text-sm py-2"
            >
              🖥️ Screen
            </button>
          </div>
        </div>
      ) : (
        /* While streaming — show controls */
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mute toggle */}
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isMuted
                ? 'bg-red-900/50 text-red-400 border border-red-800'
                : 'bg-dark-hover text-text-primary hover:bg-dark-border'
            }`}
          >
            {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
          </button>

          {/* Camera toggle */}
          <button
            onClick={onToggleCamera}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isCameraOff
                ? 'bg-red-900/50 text-red-400 border border-red-800'
                : 'bg-dark-hover text-text-primary hover:bg-dark-border'
            }`}
          >
            {isCameraOff ? '📷 Show Camera' : '🎥 Hide Camera'}
          </button>

          {/* End stream */}
          <button
            onClick={onEndStream}
            className="ml-auto btn-secondary text-sm text-red-400 border-red-900 hover:border-red-600 hover:bg-red-950/30"
          >
            ■ End Stream
          </button>
        </div>
      )}
    </div>
  );
}