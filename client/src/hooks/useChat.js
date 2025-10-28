import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

export const useChat = () => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('rooms:list', (roomsList) => {
      setRooms(roomsList);
    });

    socket.on('users:online', (users) => {
      setOnlineUsers(users);
    });

    socket.on('room:joined', ({ roomId, messages: roomMessages }) => {
      setCurrentRoom(roomId);
      setMessages(roomMessages);
    });

    socket.on('message:new', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('typing:update', ({ roomId, users }) => {
      if (roomId === currentRoom) {
        setTypingUsers(users);
      }
    });

    socket.on('user:status', ({ userId, username, online }) => {
      setOnlineUsers(prev => {
        if (online) {
          return prev.some(u => u.id === userId) ? prev : [...prev, { id: userId, username }];
        } else {
          return prev.filter(u => u.id !== userId);
        }
      });
    });

    return () => {
      socket.off('rooms:list');
      socket.off('users:online');
      socket.off('room:joined');
      socket.off('message:new');
      socket.off('typing:update');
      socket.off('user:status');
    };
  }, [socket, currentRoom]);

  const sendMessage = useCallback((content) => {
    if (socket && content.trim()) {
      socket.emit('message:send', {
        roomId: currentRoom,
        content: content.trim(),
        type: 'text'
      });
    }
  }, [socket, currentRoom]);

  const joinRoom = useCallback((roomId) => {
    if (socket) {
      socket.emit('room:join', roomId);
    }
  }, [socket]);

  const startTyping = useCallback(() => {
    if (socket) {
      socket.emit('typing:start', { roomId: currentRoom });
    }
  }, [socket, currentRoom]);

  const stopTyping = useCallback(() => {
    if (socket) {
      socket.emit('typing:stop', { roomId: currentRoom });
    }
  }, [socket, currentRoom]);

  const addReaction = useCallback((messageId, reaction) => {
    if (socket) {
      socket.emit('message:react', { messageId, roomId: currentRoom, reaction });
    }
  }, [socket, currentRoom]);

  return {
    messages,
    rooms,
    currentRoom,
    onlineUsers,
    typingUsers,
    sendMessage,
    joinRoom,
    startTyping,
    stopTyping,
    addReaction,
    setMessages
  };
};