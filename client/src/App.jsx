import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, Users, Bell, Settings, Search, Smile, Image, Paperclip, MessageCircle, Hash, LogOut } from 'lucide-react';

const SERVER_URL = 'http://localhost:3001';

export default function ChatApp() {
  const [socket, setSocket] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [currentRoom, setCurrentRoom] = useState('general');
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserList, setShowUserList] = useState(true);
  const [privateChats, setPrivateChats] = useState(new Map());
  const [activePrivateChat, setActivePrivateChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const audioRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
    }
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const showBrowserNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/chat-icon.png' });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      const response = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });

      const data = await response.json();
      
      if (response.ok) {
        setUserId(data.userId);
        localStorage.setItem('chatToken', data.token);
        localStorage.setItem('chatUsername', data.username);
        initSocket(data.token);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
  };

  const initSocket = (token) => {
    const newSocket = io(SERVER_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setAuthenticated(true);
      setIsReconnecting(false);
      requestNotificationPermission();
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsReconnecting(true);
    });

    newSocket.on('users:online', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('rooms:list', (roomsList) => {
      setRooms(roomsList);
    });

    newSocket.on('room:joined', ({ roomId, messages }) => {
      setCurrentRoom(roomId);
      setMessages(messages);
      setActivePrivateChat(null);
    });

    newSocket.on('message:new', (message) => {
      setMessages(prev => [...prev, message]);
      if (message.userId !== userId) {
        playNotificationSound();
        setUnreadCount(prev => prev + 1);
        showBrowserNotification('New Message', `${message.username}: ${message.content}`);
      }
    });

    newSocket.on('message:private-new', (message) => {
      const conversationId = [message.from, message.to].sort().join('-');
      setPrivateChats(prev => {
        const updated = new Map(prev);
        const messages = updated.get(conversationId) || [];
        updated.set(conversationId, [...messages, message]);
        return updated;
      });
      playNotificationSound();
      showBrowserNotification('Private Message', `${message.fromUsername}: ${message.content}`);
    });

    newSocket.on('message:private-sent', (message) => {
      const conversationId = [message.from, message.to].sort().join('-');
      setPrivateChats(prev => {
        const updated = new Map(prev);
        const messages = updated.get(conversationId) || [];
        updated.set(conversationId, [...messages, message]);
        return updated;
      });
    });

    newSocket.on('user:status', ({ userId: statusUserId, username: statusUsername, online }) => {
      setOnlineUsers(prev => {
        if (online) {
          return prev.some(u => u.id === statusUserId) ? prev : [...prev, { id: statusUserId, username: statusUsername }];
        } else {
          return prev.filter(u => u.id !== statusUserId);
        }
      });
      
      addNotification({
        type: 'status',
        message: `${statusUsername} is now ${online ? 'online' : 'offline'}`,
        timestamp: Date.now()
      });
    });

    newSocket.on('typing:update', ({ roomId, users }) => {
      if (roomId === currentRoom) {
        setTypingUsers(users);
      }
    });

    newSocket.on('notification:new', (notification) => {
      addNotification(notification);
      playNotificationSound();
    });

    newSocket.on('message:reaction-update', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reactions } : msg
      ));
    });

    setSocket(newSocket);
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [...prev, { ...notification, id: Date.now() }].slice(-5));
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 5000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket) return;

    if (activePrivateChat) {
      socket.emit('message:private', {
        recipientId: activePrivateChat,
        content: inputMessage.trim()
      });
    } else {
      socket.emit('message:send', {
        roomId: currentRoom,
        content: inputMessage.trim(),
        type: 'text'
      });
    }

    setInputMessage('');
    stopTyping();
  };

  const handleTyping = () => {
    if (!socket || activePrivateChat) return;

    socket.emit('typing:start', { roomId: currentRoom });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (socket && !activePrivateChat) {
      socket.emit('typing:stop', { roomId: currentRoom });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const joinRoom = (roomId) => {
    if (socket) {
      socket.emit('room:join', roomId);
      setMessages([]);
    }
  };

  const startPrivateChat = (user) => {
    setActivePrivateChat(user.id);
    const conversationId = [userId, user.id].sort().join('-');
    
    if (!privateChats.has(conversationId)) {
      socket.emit('private:get', { recipientId: user.id });
      socket.on('private:messages', ({ conversationId: convId, messages }) => {
        if (convId === conversationId) {
          setPrivateChats(prev => {
            const updated = new Map(prev);
            updated.set(convId, messages);
            return updated;
          });
        }
      });
    }
  };

  const addReaction = (messageId, reaction) => {
    if (socket) {
      socket.emit('message:react', { messageId, roomId: currentRoom, reaction });
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    localStorage.removeItem('chatToken');
    localStorage.removeItem('chatUsername');
    setAuthenticated(false);
    setUsername('');
    setSocket(null);
  };

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCurrentMessages = () => {
    if (activePrivateChat) {
      const conversationId = [userId, activePrivateChat].sort().join('-');
      return privateChats.get(conversationId) || [];
    }
    return searchTerm ? filteredMessages : messages;
  };

  const getCurrentChatName = () => {
    if (activePrivateChat) {
      const user = onlineUsers.find(u => u.id === activePrivateChat);
      return user ? `@${user.username}` : 'Private Chat';
    }
    const room = rooms.find(r => r.id === currentRoom);
    return room ? room.name : 'Chat';
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZizkJF2m98OScTgwMUKnk7rZjHQU5k9n0y3ksBS" />
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <MessageCircle className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Welcome to ChatFlow</h1>
            <p className="text-gray-600 mt-2">Join the conversation</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition duration-200 transform hover:scale-105"
            >
              Join Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <div className={`${showUserList ? 'w-64' : 'w-16'} bg-gray-900 text-white flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          {showUserList && <h2 className="font-bold text-lg">ChatFlow</h2>}
          <button onClick={() => setShowUserList(!showUserList)} className="p-2 hover:bg-gray-800 rounded">
            <Users className="w-5 h-5" />
          </button>
        </div>

        {showUserList && (
          <>
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Rooms</h3>
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => joinRoom(room.id)}
                  className={`w-full text-left p-2 rounded mb-1 flex items-center justify-between hover:bg-gray-800 transition ${
                    currentRoom === room.id && !activePrivateChat ? 'bg-gray-800' : ''
                  }`}
                >
                  <span className="flex items-center">
                    <Hash className="w-4 h-4 mr-2" />
                    {room.name}
                  </span>
                  <span className="text-xs text-gray-400">{room.userCount}</span>
                </button>
              ))}
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Online ({onlineUsers.length})</h3>
              {onlineUsers.filter(u => u.id !== userId).map(user => (
                <button
                  key={user.id}
                  onClick={() => startPrivateChat(user)}
                  className={`w-full text-left p-2 rounded mb-1 hover:bg-gray-800 transition flex items-center ${
                    activePrivateChat === user.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  {user.username}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center mr-2">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{username}</span>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{getCurrentChatName()}</h2>
            {typingUsers.length > 0 && !activePrivateChat && (
              <p className="text-sm text-gray-600">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-3" />
            </div>
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-600 cursor-pointer" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="absolute top-20 right-4 z-50 space-y-2">
          {notifications.map(notif => (
            <div key={notif.id} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in">
              {notif.message || `${notif.from}: ${notif.content}`}
            </div>
          ))}
        </div>

        {/* Reconnection Banner */}
        {isReconnecting && (
          <div className="bg-yellow-500 text-white px-4 py-2 text-center">
            Reconnecting to server...
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {getCurrentMessages().length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            </div>
          ) : (
            getCurrentMessages().map((msg, index) => {
              const isOwnMessage = msg.userId === userId || msg.from === userId;
              const showAvatar = index === 0 || getCurrentMessages()[index - 1].userId !== msg.userId;
              
              return (
                <div key={msg.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end max-w-xl`}>
                    {showAvatar && !isOwnMessage && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm mr-2">
                        {(msg.username || msg.fromUsername || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                      {showAvatar && !isOwnMessage && (
                        <span className="text-xs text-gray-600 mb-1 ml-2">{msg.username || msg.fromUsername}</span>
                      )}
                      
                      <div className={`group relative px-4 py-2 rounded-2xl ${
                        isOwnMessage 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white text-gray-800 border border-gray-200'
                      }`}>
                        <p className="break-words">{msg.content}</p>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${isOwnMessage ? 'text-indigo-200' : 'text-gray-500'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex gap-1">
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                users.length > 0 && (
                                  <span key={emoji} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                    {emoji} {users.length}
                                  </span>
                                )
                              ))}
                            </div>
                          )}
                        </div>

                        {!activePrivateChat && (
                          <div className="absolute bottom-0 right-0 transform translate-y-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-lg p-2 flex gap-1">
                            {['👍', '❤️', '😂', '😮', '🎉'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => addReaction(msg.id, emoji)}
                                className="hover:scale-125 transition-transform text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <button
              type="button"
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            
            <button
              type="button"
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
              title="Add image"
            >
              <Image className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Type a message..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                rows="1"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            <button
              type="button"
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
              title="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-lg transition duration-200 transform hover:scale-105 disabled:hover:scale-100"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}