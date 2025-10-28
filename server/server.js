const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-secret-key-change-in-production';
const PORT = 3001;

// Data stores (in production, use a database)
const users = new Map();
const rooms = new Map([
  ['general', { name: 'General', messages: [], users: new Set() }],
  ['random', { name: 'Random', messages: [], users: new Set() }],
  ['tech', { name: 'Tech Talk', messages: [], users: new Set() }]
]);
const privateMessages = new Map();
const typingUsers = new Map();

// Authentication endpoint
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const userId = Date.now().toString();
  const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '24h' });
  
  res.json({ token, userId, username });
});

// Socket.io middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.username} (${socket.userId})`);

  // Add user to users map
  users.set(socket.userId, {
    id: socket.userId,
    username: socket.username,
    socketId: socket.id,
    online: true,
    lastSeen: Date.now()
  });

  // Join default room
  socket.join('general');
  rooms.get('general').users.add(socket.userId);

  // Broadcast user online status
  io.emit('user:status', {
    userId: socket.userId,
    username: socket.username,
    online: true
  });

  // Send online users list
  const onlineUsers = Array.from(users.values())
    .filter(u => u.online)
    .map(u => ({ id: u.id, username: u.username }));
  socket.emit('users:online', onlineUsers);

  // Send available rooms
  const roomsList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    userCount: room.users.size
  }));
  socket.emit('rooms:list', roomsList);

  // Join room
  socket.on('room:join', (roomId) => {
    if (!rooms.has(roomId)) {
      return socket.emit('error', { message: 'Room not found' });
    }

    // Leave previous rooms except private ones
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id && rooms.has(room)) {
        socket.leave(room);
        rooms.get(room).users.delete(socket.userId);
      }
    });

    // Join new room
    socket.join(roomId);
    rooms.get(roomId).users.add(socket.userId);

    // Send room history
    const room = rooms.get(roomId);
    socket.emit('room:joined', {
      roomId,
      messages: room.messages.slice(-50)
    });

    // Notify others
    socket.to(roomId).emit('room:user-joined', {
      userId: socket.userId,
      username: socket.username,
      roomId
    });

    // Update room user counts
    io.emit('rooms:list', Array.from(rooms.entries()).map(([id, r]) => ({
      id,
      name: r.name,
      userCount: r.users.size
    })));
  });

  // Send message to room
  socket.on('message:send', (data) => {
    const { roomId, content, type = 'text' } = data;

    if (!rooms.has(roomId)) {
      return socket.emit('error', { message: 'Room not found' });
    }

    const message = {
      id: Date.now().toString() + Math.random(),
      userId: socket.userId,
      username: socket.username,
      content,
      type,
      timestamp: Date.now(),
      roomId,
      reactions: {}
    };

    rooms.get(roomId).messages.push(message);

    // Send to all users in room
    io.to(roomId).emit('message:new', message);

    // Send notification to other users
    socket.to(roomId).emit('notification:new', {
      type: 'message',
      from: socket.username,
      content: content.substring(0, 50),
      roomId,
      timestamp: Date.now()
    });
  });

  // Private message
  socket.on('message:private', (data) => {
    const { recipientId, content } = data;
    const recipient = users.get(recipientId);

    if (!recipient) {
      return socket.emit('error', { message: 'User not found' });
    }

    const message = {
      id: Date.now().toString() + Math.random(),
      from: socket.userId,
      fromUsername: socket.username,
      to: recipientId,
      toUsername: recipient.username,
      content,
      timestamp: Date.now(),
      read: false
    };

    // Store private message
    const conversationId = [socket.userId, recipientId].sort().join('-');
    if (!privateMessages.has(conversationId)) {
      privateMessages.set(conversationId, []);
    }
    privateMessages.get(conversationId).push(message);

    // Send to recipient
    io.to(recipient.socketId).emit('message:private-new', message);
    
    // Send confirmation to sender
    socket.emit('message:private-sent', message);

    // Send notification
    io.to(recipient.socketId).emit('notification:new', {
      type: 'private-message',
      from: socket.username,
      content: content.substring(0, 50),
      timestamp: Date.now()
    });
  });

  // Typing indicator
  socket.on('typing:start', (data) => {
    const { roomId } = data;
    if (!typingUsers.has(roomId)) {
      typingUsers.set(roomId, new Set());
    }
    typingUsers.get(roomId).add(socket.userId);
    
    socket.to(roomId).emit('typing:update', {
      roomId,
      users: Array.from(typingUsers.get(roomId))
        .map(uid => users.get(uid)?.username)
        .filter(Boolean)
    });
  });

  socket.on('typing:stop', (data) => {
    const { roomId } = data;
    if (typingUsers.has(roomId)) {
      typingUsers.get(roomId).delete(socket.userId);
      
      socket.to(roomId).emit('typing:update', {
        roomId,
        users: Array.from(typingUsers.get(roomId))
          .map(uid => users.get(uid)?.username)
          .filter(Boolean)
      });
    }
  });

  // Message reactions
  socket.on('message:react', (data) => {
    const { messageId, roomId, reaction } = data;
    const room = rooms.get(roomId);

    if (!room) return;

    const message = room.messages.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) message.reactions = {};
    if (!message.reactions[reaction]) message.reactions[reaction] = [];

    const userIndex = message.reactions[reaction].indexOf(socket.userId);
    if (userIndex > -1) {
      message.reactions[reaction].splice(userIndex, 1);
    } else {
      message.reactions[reaction].push(socket.userId);
    }

    io.to(roomId).emit('message:reaction-update', {
      messageId,
      reactions: message.reactions
    });
  });

  // Mark message as read
  socket.on('message:read', (data) => {
    const { messageId, conversationId } = data;
    const messages = privateMessages.get(conversationId);

    if (messages) {
      const message = messages.find(m => m.id === messageId);
      if (message && message.to === socket.userId) {
        message.read = true;
        
        const sender = users.get(message.from);
        if (sender) {
          io.to(sender.socketId).emit('message:read-receipt', {
            messageId,
            conversationId
          });
        }
      }
    }
  });

  // Get private messages
  socket.on('private:get', (data) => {
    const { recipientId } = data;
    const conversationId = [socket.userId, recipientId].sort().join('-');
    const messages = privateMessages.get(conversationId) || [];
    
    socket.emit('private:messages', {
      conversationId,
      messages: messages.slice(-50)
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username}`);

    const user = users.get(socket.userId);
    if (user) {
      user.online = false;
      user.lastSeen = Date.now();
    }

    // Remove from rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.userId)) {
        room.users.delete(socket.userId);
        socket.to(roomId).emit('room:user-left', {
          userId: socket.userId,
          username: socket.username,
          roomId
        });
      }
    });

    // Broadcast offline status
    io.emit('user:status', {
      userId: socket.userId,
      username: socket.username,
      online: false
    });

    // Update room counts
    io.emit('rooms:list', Array.from(rooms.entries()).map(([id, r]) => ({
      id,
      name: r.name,
      userCount: r.users.size
    })));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});