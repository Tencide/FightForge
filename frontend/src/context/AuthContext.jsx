/* eslint-disable react-refresh/only-export-components -- context + hook module */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { apiFetch, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('fightforge_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const persistUser = useCallback((next) => {
    setUser(next);
    if (next) localStorage.setItem('fightforge_user', JSON.stringify(next));
    else localStorage.removeItem('fightforge_user');
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null,
    });
    setToken(data.token);
    persistUser(data.user);
    return data.user;
  }, [persistUser]);

  const logout = useCallback(() => {
    setToken(null);
    persistUser(null);
  }, [persistUser]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id || !getToken()) return null;
    const profile = await apiFetch(`/api/auth/profile/${user.id}`);
    persistUser(profile);
    return profile;
  }, [persistUser, user]);

  const value = useMemo(
    () => ({
      user,
      token: getToken(),
      isAuthenticated: Boolean(getToken() && user),
      login,
      logout,
      refreshProfile,
    }),
    [user, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
