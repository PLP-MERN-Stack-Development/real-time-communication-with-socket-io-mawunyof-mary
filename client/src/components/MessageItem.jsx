import React from 'react';

export default function MessageItem({ message, isOwnMessage, showAvatar, onReaction }) {
  const reactions = ['👍', '❤️', '😂', '😮', '🎉'];

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end max-w-xl`}>
        {showAvatar && !isOwnMessage && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm mr-2">
            {(message.username || message.fromUsername || 'U').charAt(0).toUpperCase()}
          </div>
        )}
        
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {showAvatar && !isOwnMessage && (
            <span className="text-xs text-gray-600 mb-1 ml-2">
              {message.username || message.fromUsername}
            </span>
          )}
          
          <div className={`group relative px-4 py-2 rounded-2xl ${
            isOwnMessage 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white text-gray-800 border border-gray-200'
          }`}>
            <p className="break-words">{message.content}</p>
            
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs ${isOwnMessage ? 'text-indigo-200' : 'text-gray-500'}`}>
                {new Date(message.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
              
              {message.reactions && Object.keys(message.reactions).length > 0 && (
                <div className="flex gap-1">
                  {Object.entries(message.reactions).map(([emoji, users]) => (
                    users.length > 0 && (
                      <span key={emoji} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                        {emoji} {users.length}
                      </span>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Reaction Picker */}
            <div className="absolute bottom-0 right-0 transform translate-y-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-lg p-2 flex gap-1">
              {reactions.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onReaction(message.id, emoji)}
                  className="hover:scale-125 transition-transform text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}