import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api';

export interface User {
  _id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setCurrentUser(res.data);
      return res.data;
    } catch {
      setCurrentUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.location.pathname === '/login') {
      setLoading(false);
    } else {
      fetchUser();
    }
  }, []);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    setCurrentUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};
