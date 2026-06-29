import React from 'react';

export default function VideoPlayer({ videoRef, connectionState, isLive }) {
  const showOverlay = connectionState !== 'connected';

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        className="w-full h-full object-cover"
      />

      {showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-base">
          {!isLive ? (
            <>
              <div className="text-5xl mb-3">📺</div>
              <p className="text-text-secondary text-sm">Stream is offline</p>
            </>
          ) : connectionState === 'connecting' ? (
            <>
              <div className="w-8 h-8 border-2 border-dark-border border-t-brand rounded-full animate-spin mb-3" />
              <p className="text-text-secondary text-sm">Connecting to stream...</p>
            </>
          ) : connectionState === 'failed' ? (
            <>
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-text-secondary text-sm">Connection failed. Try refreshing.</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">🎥</div>
              <p className="text-text-secondary text-sm">Waiting for stream to start...</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}