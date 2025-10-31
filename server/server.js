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
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-secret-key-change-in-production';
const PORT = 3001;

const users = new Map();
const rooms = new Map([
  ['general', { name: 'General', messages: [], users: new Set() }],
  ['random', { name: 'Random', messages: [], users: new Set() }],
  ['tech', { name: 'Tech Talk', messages: [], users: new Set() }]
]);
const privateMessages = new Map();
const typingUsers = new Map();

app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const userId = Date.now().toString();
  const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '24h' });
  
  res.json({ token, userId, username });
});

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

io.on('connection', (socket) => {
  console.log(`\n🔌 ${socket.username} connected`);
  console.log(`   ID: ${socket.userId}`);
  console.log(`   Socket: ${socket.id}`);

  const existingUser = Array.from(users.values()).find(u => u.username === socket.username);
  if (existingUser) {
    console.log(`⚠️  Removing old connection`);
    users.delete(existingUser.id);
  }

  users.set(socket.userId, {
    id: socket.userId,
    username: socket.username,
    socketId: socket.id,
    online: true,
    lastSeen: Date.now()
  });

  console.log('📋 Online users:');
  users.forEach((user) => {
    console.log(`   - ${user.username}`);
  });

  socket.join('general');
  rooms.get('general').users.add(socket.userId);

  io.emit('user:status', {
    userId: socket.userId,
    username: socket.username,
    online: true
  });

  const onlineUsers = Array.from(users.values())
    .filter(u => u.online)
    .map(u => ({ id: u.id, username: u.username }));
  socket.emit('users:online', onlineUsers);

  const roomsList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    userCount: room.users.size
  }));
  socket.emit('rooms:list', roomsList);

  socket.on('room:join', (roomId) => {
    if (!rooms.has(roomId)) {
      return socket.emit('error', { message: 'Room not found' });
    }

    console.log(`📍 ${socket.username} → ${roomId}`);

    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id && rooms.has(room)) {
        socket.leave(room);
        rooms.get(room).users.delete(socket.userId);
      }
    });

    socket.join(roomId);
    rooms.get(roomId).users.add(socket.userId);

    const room = rooms.get(roomId);
    socket.emit('room:joined', {
      roomId,
      messages: room.messages.slice(-50)
    });

    socket.to(roomId).emit('room:user-joined', {
      userId: socket.userId,
      username: socket.username,
      roomId
    });

    io.emit('rooms:list', Array.from(rooms.entries()).map(([id, r]) => ({
      id,
      name: r.name,
      userCount: r.users.size
    })));
  });

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
    io.to(roomId).emit('message:new', message);

    socket.to(roomId).emit('notification:new', {
      type: 'message',
      from: socket.username,
      content: content.substring(0, 50),
      roomId,
      timestamp: Date.now()
    });
  });

  socket.on('message:private', (data) => {
    const { recipientId, content } = data;
    
    console.log(`\n💬 ${socket.username} → Recipient ID: ${recipientId}`);
    console.log(`   Content: "${content}"`);
    
    const recipient = users.get(recipientId);
    if (!recipient) {
      console.log('❌ Recipient not found');
      return socket.emit('error', { message: 'User not found' });
    }

    console.log(`✅ Found: ${recipient.username}`);

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

    const conversationId = [socket.userId, recipientId].sort().join('-');
    if (!privateMessages.has(conversationId)) {
      privateMessages.set(conversationId, []);
    }
    privateMessages.get(conversationId).push(message);
    
    console.log(`💾 Stored. Total: ${privateMessages.get(conversationId).length}`);
    console.log(`📡 Broadcasting to ALL clients`);
    
    io.emit('message:private-universal', message);
    
    console.log('✅ Broadcast complete\n');
  });

  socket.on('private:get', (data) => {
    const { recipientId } = data;
    const conversationId = [socket.userId, recipientId].sort().join('-');
    const messages = privateMessages.get(conversationId) || [];
    
    console.log(`📥 ${socket.username} loading conversation with ${recipientId}`);
    console.log(`   Messages: ${messages.length}`);
    
    socket.emit('private:messages', {
      conversationId,
      messages: messages.slice(-50)
    });
  });

  socket.on('typing:start', (data) => {
    const { roomId } = data;
    
    if (!typingUsers.has(roomId)) {
      typingUsers.set(roomId, new Set());
    }
    typingUsers.get(roomId).add(socket.userId);
    
    const typingUsernames = Array.from(typingUsers.get(roomId))
      .map(uid => users.get(uid)?.username)
      .filter(Boolean);
    
    socket.to(roomId).emit('typing:update', {
      roomId,
      users: typingUsernames
    });
  });

  socket.on('typing:stop', (data) => {
    const { roomId } = data;
    
    if (typingUsers.has(roomId)) {
      typingUsers.get(roomId).delete(socket.userId);
      
      const typingUsernames = Array.from(typingUsers.get(roomId))
        .map(uid => users.get(uid)?.username)
        .filter(Boolean);
      
      socket.to(roomId).emit('typing:update', {
        roomId,
        users: typingUsernames
      });
    }
  });

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

  socket.on('disconnect', () => {
    console.log(`\n❌ ${socket.username} disconnected`);

    const user = users.get(socket.userId);
    if (user) {
      user.online = false;
      user.lastSeen = Date.now();
    }

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

    io.emit('user:status', {
      userId: socket.userId,
      username: socket.username,
      online: false
    });

    io.emit('rooms:list', Array.from(rooms.entries()).map(([id, r]) => ({
      id,
      name: r.name,
      userCount: r.users.size
    })));
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Server on port ${PORT}\n`);
});
