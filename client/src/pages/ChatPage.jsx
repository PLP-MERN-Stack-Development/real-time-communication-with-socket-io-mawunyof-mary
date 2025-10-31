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

  useEffect(() => {
    if (!socket) return;

    const handlePrivateUniversal = (message) => {
      try {
        const userId = localStorage.getItem('chatUserId');
        console.log('\n📡 Universal message received:');
        console.log('   From:', message.fromUsername, '(ID:', message.from, ')');
        console.log('   To:', message.toUsername, '(ID:', message.to, ')');
        console.log('   My ID:', userId);
        console.log('   Content:', message.content);
        
        if (message.to === userId || message.from === userId) {
          console.log('✅ This message is for me!');
          
          // Sort IDs as strings to ensure consistency
          const conversationId = [String(message.from), String(message.to)].sort().join('-');
          console.log('   Conversation ID:', conversationId);
          
          setPrivateChats(prev => {
            const updated = new Map(prev);
            const existing = updated.get(conversationId) || [];
            
            console.log('   Existing messages:', existing.length);
            
            const isDuplicate = existing.some(m => m.id === message.id);
            if (!isDuplicate) {
              const newMessages = [...existing, message];
              updated.set(conversationId, newMessages);
              console.log('   💾 Saved! Total now:', newMessages.length);
              console.log('   All conversation IDs:', Array.from(updated.keys()));
            } else {
              console.log('   ⚠️  Duplicate message, skipping');
            }
            
            return updated;
          });
        } else {
          console.log('❌ Not for me, ignoring');
        }
      } catch (error) {
        console.error('Error handling private message:', error);
      }
    };

    const handlePrivateMessages = (data) => {
      try {
        console.log('\n📦 Loading conversation:', data.conversationId);
        console.log('   Messages count:', data.messages.length);
        
        setPrivateChats(prev => {
          const updated = new Map(prev);
          updated.set(data.conversationId, data.messages);
          console.log('   ✅ Loaded successfully');
          return updated;
        });
      } catch (error) {
        console.error('Error loading private messages:', error);
      }
    };

    const handleReactionUpdate = (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg
      ));
    };

    socket.on('message:private-universal', handlePrivateUniversal);
    socket.on('private:messages', handlePrivateMessages);
    socket.on('message:reaction-update', handleReactionUpdate);

    return () => {
      socket.off('message:private-universal', handlePrivateUniversal);
      socket.off('private:messages', handlePrivateMessages);
      socket.off('message:reaction-update', handleReactionUpdate);
    };
  }, [socket, setMessages]);

  const handleRoomSelect = (roomId) => {
    joinRoom(roomId);
    setActivePrivateChat(null);
  };

  const handleUserSelect = (selectedUser) => {
    console.log('\n👤 Opening private chat with:', selectedUser.username);
    console.log('   Their ID:', selectedUser.id);
    setActivePrivateChat(selectedUser);
    
    if (socket) {
      socket.emit('private:get', { recipientId: selectedUser.id });
    }
  };

  const handleSendMessage = (content) => {
    if (activePrivateChat && socket) {
      console.log('\n📤 Sending private message to:', activePrivateChat.username);
      console.log('   Recipient ID:', activePrivateChat.id);
      console.log('   Content:', content.trim());
      
      socket.emit('message:private', {
        recipientId: activePrivateChat.id,
        content: content.trim()
      });
    } else {
      sendMessage(content);
    }
  };

  const handleReaction = (messageId, reaction) => {
    if (!activePrivateChat) {
      addReaction(messageId, reaction);
    }
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
      const userId = localStorage.getItem('chatUserId');
      
      // Ensure both IDs are strings and sorted
      const conversationId = [String(userId), String(activePrivateChat.id)].sort().join('-');
      
      console.log('\n🔍 Getting messages for display:');
      console.log('   My ID:', userId);
      console.log('   Chat with ID:', activePrivateChat.id);
      console.log('   Calculated conversation ID:', conversationId);
      console.log('   All stored conversations:', Array.from(privateChats.keys()));
      
      const privateMessages = privateChats.get(conversationId);
      
      if (privateMessages) {
        console.log('   ✅ Found', privateMessages.length, 'messages');
        console.log('   Messages:', privateMessages.map(m => ({
          from: m.fromUsername,
          to: m.toUsername,
          content: m.content.substring(0, 30)
        })));
      } else {
        console.log('   ❌ No messages found for this conversation ID');
        console.log('   Checking all conversations:');
        privateChats.forEach((msgs, convId) => {
          console.log(`      ${convId}: ${msgs.length} messages`);
        });
      }
      
      return privateMessages || [];
    }
    
    if (searchTerm) {
      return messages.filter(msg =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (msg.username && msg.username.toLowerCase().includes(searchTerm.toLowerCase()))
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
          currentUserId={localStorage.getItem('chatUserId')}
        />

        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={activePrivateChat ? () => {} : startTyping}
          onStopTyping={activePrivateChat ? () => {} : stopTyping}
        />
      </div>
    </div>
  );
}