/**
 * AuthContext.jsx — Global Authentication State
 *
 * FIX: Removed useNavigate() because AuthProvider sits at the root level
 * and useNavigate was conflicting with BrowserRouter, causing the
 * "cannot render a Router inside another Router" error.
 *
 * Instead we use window.location.href for login/logout redirects.
 * This causes a full page reload, but login/logout only happen once
 * per session so the UX impact is zero.
 */

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (tokenData) => {
    localStorage.setItem('access_token', tokenData.access_token);

    const userData = {
      id: tokenData.user_id,
      name: tokenData.name,
      role: tokenData.role,
    };
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    // Redirect based on role
    if (tokenData.role === 'supervisor') {
      window.location.href = '/dashboard';
    } else {
      window.location.href = '/my-tickets';
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}