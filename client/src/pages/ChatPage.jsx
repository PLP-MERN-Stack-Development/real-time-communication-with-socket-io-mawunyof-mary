import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import { useNotifications } from '../hooks/useNotifications';
import Sidebar from '../components/Sidebar';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import Notifications from '../components/Notifications';

export default function ChatPage() {
  const { user } = useAuth();
  const { socket, isReconnecting } = useSocket();
  const {
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
  } = useChat();
  
  const {
    notifications,
    unreadCount,
    setUnreadCount,
    requestNotificationPermission
  } = useNotifications();

  const [showUserList, setShowUserList] = useState(true);
  const [activePrivateChat, setActivePrivateChat] = useState(null);
  const [privateChats, setPrivateChats] = useState(new Map());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (socket) {
      requestNotificationPermission();
    }
  }, [socket, requestNotificationPermission]);

  // Handle private messages
  useEffect(() => {
    if (!socket) return;

    socket.on('message:private-new', (message) => {
      const conversationId = [message.from, message.to].sort().join('-');
      setPrivateChats(prev => {
        const updated = new Map(prev);
        const messages = updated.get(conversationId) || [];
        updated.set(conversationId, [...messages, message]);
        return updated;
      });
    });

    socket.on('message:private-sent', (message) => {
      const conversationId = [message.from, message.to].sort().join('-');
      setPrivateChats(prev => {
        const updated = new Map(prev);
        const messages = updated.get(conversationId) || [];
        updated.set(conversationId, [...messages, message]);
        return updated;
      });
    });

    socket.on('message:reaction-update', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reactions } : msg
      ));
    });

    socket.on('private:messages', ({ conversationId, messages }) => {
      setPrivateChats(prev => {
        const updated = new Map(prev);
        updated.set(conversationId, messages);
        return updated;
      });
    });

    return () => {
      socket.off('message:private-new');
      socket.off('message:private-sent');
      socket.off('message:reaction-update');
      socket.off('private:messages');
    };
  }, [socket, setMessages]);

  const handleRoomSelect = (roomId) => {
    joinRoom(roomId);
    setActivePrivateChat(null);
  };

  const handleUserSelect = (selectedUser) => {
    setActivePrivateChat(selectedUser);
    const conversationId = [user.userId || localStorage.getItem('chatUserId'), selectedUser.id].sort().join('-');
    
    if (!privateChats.has(conversationId)) {
      socket.emit('private:get', { recipientId: selectedUser.id });
    }
  };

  const handleSendMessage = (content) => {
    if (activePrivateChat) {
      socket.emit('message:private', {
        recipientId: activePrivateChat.id,
        content: content.trim()
      });
    } else {
      sendMessage(content);
    }
  };

  const handleReaction = (messageId, reaction) => {
    addReaction(messageId, reaction);
  };

  const getChatName = () => {
    if (activePrivateChat) {
      return `@${activePrivateChat.username}`;
    }
    const room = rooms.find(r => r.id === currentRoom);
    return room ? room.name : 'Chat';
  };

  const getCurrentMessages = () => {
    if (activePrivateChat) {
      const userId = user.userId || localStorage.getItem('chatUserId');
      const conversationId = [userId, activePrivateChat.id].sort().join('-');
      return privateChats.get(conversationId) || [];
    }
    
    if (searchTerm) {
      return messages.filter(msg =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return messages;
  };

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar
        rooms={rooms}
        currentRoom={currentRoom}
        onRoomSelect={handleRoomSelect}
        onlineUsers={onlineUsers}
        onUserSelect={handleUserSelect}
        activePrivateChat={activePrivateChat}
        showUserList={showUserList}
        onToggleSidebar={() => setShowUserList(!showUserList)}
      />

      <div className="flex-1 flex flex-col">
        <ChatHeader
          chatName={getChatName()}
          typingUsers={activePrivateChat ? [] : typingUsers}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          unreadCount={unreadCount}
        />

        <Notifications notifications={notifications} />

        {isReconnecting && (
          <div className="bg-yellow-500 text-white px-4 py-2 text-center">
            Reconnecting to server...
          </div>
        )}

        <MessageList
          messages={getCurrentMessages()}
          onReaction={handleReaction}
          currentUserId={user?.userId || localStorage.getItem('chatUserId')}
        />

        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={startTyping}
          onStopTyping={stopTyping}
        />
      </div>
    </div>
  );
}