// BroadcastContext.jsx
// Holds the broadcaster's camera/mic stream + WebRTC peer connections at the
// APP ROOT level (like SocketContext), not inside StreamPage. This means
// navigating to another page does NOT tear down the broadcast — it keeps
// running until the user explicitly clicks "End Stream".

import { createContext, useContext, useState, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from './SocketContext';

const BroadcastContext = createContext(null);

export const useBroadcast = () => useContext(BroadcastContext);

export const BroadcastProvider = ({ children }) => {
  const socket = useSocket();
  const [activeStreamKey, setActiveStreamKey] = useState(null);

  // Always broadcaster mode — this instance is dedicated to outgoing streams
  const webrtc = useWebRTC({ socket, streamKey: activeStreamKey, isBroadcaster: true });

  const startBroadcast = useCallback(async (streamKey, useScreen = false) => {
    setActiveStreamKey(streamKey);
    return webrtc.startLocalStream(useScreen);
  }, [webrtc]);

  const endBroadcast = useCallback(() => {
    webrtc.stopStream();
    setActiveStreamKey(null);
  }, [webrtc]);

  return (
    <BroadcastContext.Provider value={{ ...webrtc, activeStreamKey, startBroadcast, endBroadcast }}>
      {children}
    </BroadcastContext.Provider>
  );
};