import React, { useState, useRef } from 'react';
import { Send, Smile, Image, Paperclip } from 'lucide-react';

export default function MessageInput({ onSendMessage, onTyping, onStopTyping }) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);

  const handleChange = (e) => {
    setMessage(e.target.value);
    
    // Trigger typing indicator
    onTyping();
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
      onStopTyping();
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
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
            value={message}
            onChange={handleChange}
            onKeyPress={handleKeyPress}
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
          disabled={!message.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-lg transition duration-200 transform hover:scale-105 disabled:hover:scale-100"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}