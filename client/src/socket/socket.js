import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

let socket = null;

export const initializeSocket = (token) => {
  if (!socket) {
    socket = io(SERVER_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};