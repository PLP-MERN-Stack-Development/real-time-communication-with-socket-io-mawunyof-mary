import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';

export default function MessageList({ messages, onReaction, currentUserId }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">No messages yet</p>
          <p className="text-sm mt-2">Start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {messages.map((msg, index) => (
        <MessageItem
          key={msg.id}
          message={msg}
          isOwnMessage={msg.userId === currentUserId || msg.from === currentUserId}
          showAvatar={index === 0 || messages[index - 1].userId !== msg.userId}
          onReaction={onReaction}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}