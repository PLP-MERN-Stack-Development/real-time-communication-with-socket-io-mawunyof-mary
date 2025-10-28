import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

export const useNotifications = () => {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZizkJF2m98OScTgwMUKnk7rZjHQU5k9n0y3ksBS');
    audioRef.current.volume = 0.3;
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, []);

  const showBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/chat-icon.png' });
    }
  }, []);

  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const addNotification = useCallback((notification) => {
    setNotifications(prev => [...prev, { ...notification, id: Date.now() }].slice(-5));
    playNotificationSound();
    
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 5000);
  }, [playNotificationSound]);

  useEffect(() => {
    if (!socket) return;

    socket.on('notification:new', (notification) => {
      addNotification(notification);
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(
        notification.from || 'ChatFlow',
        notification.content || notification.message
      );
    });

    socket.on('message:new', (message) => {
      const userId = localStorage.getItem('chatUserId');
      if (message.userId !== userId) {
        playNotificationSound();
        setUnreadCount(prev => prev + 1);
        showBrowserNotification('New Message', `${message.username}: ${message.content}`);
      }
    });

    return () => {
      socket.off('notification:new');
      socket.off('message:new');
    };
  }, [socket, addNotification, playNotificationSound, showBrowserNotification]);

  return {
    notifications,
    unreadCount,
    setUnreadCount,
    addNotification,
    requestNotificationPermission
  };
};