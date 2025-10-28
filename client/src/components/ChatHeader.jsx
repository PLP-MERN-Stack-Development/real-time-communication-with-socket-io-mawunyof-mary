import React from 'react';
import { Bell, Search } from 'lucide-react';

export default function ChatHeader({ 
  chatName, 
  typingUsers, 
  searchTerm, 
  onSearchChange, 
  unreadCount 
}) {
  return (
    <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-gray-800">{chatName}</h2>
        {typingUsers.length > 0 && (
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
            onChange={(e) => onSearchChange(e.target.value)}
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
  );
}