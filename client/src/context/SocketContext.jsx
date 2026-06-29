import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Force websocket transport directly to eliminate connection drop/upgrade errors
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5000' 
      : window.location.origin;

    const socketInstance = io(socketUrl, {
      transports: ['websocket'], // 👈 CRITICAL: Forces WebSocket instantly, no long-polling fallback
      upgrade: false,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected securely:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    setSocket(socketInstance);

    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};