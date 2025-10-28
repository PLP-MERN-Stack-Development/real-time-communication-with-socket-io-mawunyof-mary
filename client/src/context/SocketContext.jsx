import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeSocket, getSocket, disconnectSocket } from '../socket/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      const newSocket = initializeSocket(token);
      
      newSocket.on('connect', () => {
        setIsConnected(true);
        setIsReconnecting(false);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        setIsReconnecting(true);
      });

      setSocket(newSocket);

      return () => {
        disconnectSocket();
      };
    }
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};