import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('chatToken');
    const savedUsername = localStorage.getItem('chatUsername');
    
    if (savedToken && savedUsername) {
      setToken(savedToken);
      setUser({ username: savedUsername });
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });

      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        setUser({ userId: data.userId, username: data.username });
        setIsAuthenticated(true);
        localStorage.setItem('chatToken', data.token);
        localStorage.setItem('chatUsername', data.username);
        localStorage.setItem('chatUserId', data.userId);
        return { success: true, data };
      }
      return { success: false, error: 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('chatToken');
    localStorage.removeItem('chatUsername');
    localStorage.removeItem('chatUserId');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};