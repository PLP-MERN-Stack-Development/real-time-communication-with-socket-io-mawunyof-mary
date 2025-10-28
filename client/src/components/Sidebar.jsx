import React from 'react';
import { Users, Hash, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ 
  rooms, 
  currentRoom, 
  onRoomSelect, 
  onlineUsers, 
  onUserSelect,
  activePrivateChat,
  showUserList,
  onToggleSidebar
}) {
  const { user, logout } = useAuth();

  return (
    <div className={`${showUserList ? 'w-64' : 'w-16'} bg-gray-900 text-white flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        {showUserList && <h2 className="font-bold text-lg">ChatFlow</h2>}
        <button 
          onClick={onToggleSidebar} 
          className="p-2 hover:bg-gray-800 rounded"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      {showUserList && (
        <>
          {/* Rooms Section */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Rooms
            </h3>
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => onRoomSelect(room.id)}
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

          {/* Online Users Section */}
          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Online ({onlineUsers.length})
            </h3>
            {onlineUsers
              .filter(u => u.username !== user?.username)
              .map(onlineUser => (
                <button
                  key={onlineUser.id}
                  onClick={() => onUserSelect(onlineUser)}
                  className={`w-full text-left p-2 rounded mb-1 hover:bg-gray-800 transition flex items-center ${
                    activePrivateChat?.id === onlineUser.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  {onlineUser.username}
                </button>
              ))}
          </div>

          {/* User Profile Section */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center mr-2">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{user?.username}</span>
              </div>
              <button 
                onClick={logout} 
                className="p-2 hover:bg-gray-800 rounded"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}