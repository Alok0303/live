import { useState, useEffect, useRef, useCallback } from 'react';

export function useChat({ socket, streamKey, user }) {
  const [messages, setMessages]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [error, setError]         = useState('');
  const bottomRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!socket || !streamKey) return;

    socket.emit('chat:history', { streamKey });

    const onHistory = (history) => setMessages(history);
    const onMessage = (msg) => setMessages(prev => [...prev, msg]);
    const onError   = ({ message }) => {
      setError(message);
      setTimeout(() => setError(''), 3000);
    };

    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('chat:error',   onError);

    return () => {
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:error',   onError);
    };
  }, [socket, streamKey]);

  const sendMessage = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || !user || !socket) return;

    socket.emit('chat:message', {
      streamKey,
      content:    trimmed,
      userId:     user.id,
      username:   user.username,
      avatar_url: user.avatar_url || null,
    });

    setInputText('');
  }, [inputText, user, socket, streamKey]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return { messages, inputText, setInputText, sendMessage, handleKeyDown, error, bottomRef };
}