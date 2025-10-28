import React from 'react';

export default function Notifications({ notifications }) {
  if (notifications.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 z-50 space-y-2">
      {notifications.map(notif => (
        <div 
          key={notif.id} 
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in"
        >
          {notif.message || `${notif.from}: ${notif.content}`}
        </div>
      ))}
    </div>
  );
}