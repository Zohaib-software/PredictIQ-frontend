import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  logoutApi,
  verifyTwoFactorLogin as apiVerifyTwoFactorLogin,
  completePasswordReset2fa as apiCompletePasswordReset2fa,
  completePasswordResetEmail as apiCompletePasswordResetEmail,
} from '../api/authApi';
import { ACCESS_TOKEN_KEY, clearTokens, setTokens } from '../api/tokenStorage.js';
import { clearChartCache } from '../utils/chartCache';

const AuthContext = createContext(null);
const normalizeUser = (user) => (user ? { ...user, role: user.role ?? 'user' } : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [loading, setLoading] = useState(!!localStorage.getItem(ACCESS_TOKEN_KEY));

  const setToken = useCallback((newToken, refreshToken) => {
    clearChartCache();
    if (newToken) {
      if (refreshToken) {
        setTokens(newToken, refreshToken);
      } else {
        localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
      }
      setTokenState(newToken);
    } else {
      clearTokens();
      setTokenState(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const onRefreshed = (e) => {
      const next = e.detail?.accessToken;
      if (next) setTokenState(next);
    };
    const onExpired = () => {
      setUser(null);
      setTokenState(null);
      clearChartCache();
    };
    window.addEventListener('predictiq:session-refreshed', onRefreshed);
    window.addEventListener('predictiq:auth-expired', onExpired);
    return () => {
      window.removeEventListener('predictiq:session-refreshed', onRefreshed);
      window.removeEventListener('predictiq:auth-expired', onExpired);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    getMe()
      .then(({ user: u }) => {
        if (!active) return;
        setUser(normalizeUser(u));
      })
      .catch((err) => {
        if (!active) return;
        if (err?.status === 429) return;
        if (err?.status === 401 || err?.status === 403) {
          setUser(null);
          setTokenState(null);
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const login = useCallback(async (identifier, password) => {
    const data = await apiLogin({ identifier, password });
    if (data?.requiresTwoFactor) {
      return data;
    }

    const { user: u, token: newToken, refreshToken } = data;
    setToken(newToken, refreshToken);
    const nextUser = normalizeUser(u);
    setUser(nextUser);
    return nextUser;
  }, [setToken]);

  const verifyTwoFactorLogin = useCallback(async (twoFactorToken, code) => {
    const data = await apiVerifyTwoFactorLogin({ twoFactorToken, code });
    const { user: u, token: newToken, refreshToken } = data;
    setToken(newToken, refreshToken);
    const nextUser = normalizeUser(u);
    setUser(nextUser);
    return { ...data, user: nextUser };
  }, [setToken]);

  const completePasswordReset2fa = useCallback(async (verificationToken, newPassword) => {
    const data = await apiCompletePasswordReset2fa({ verificationToken, newPassword });
    const { user: u, token: newToken, refreshToken } = data;
    setToken(newToken, refreshToken);
    const nextUser = normalizeUser(u);
    setUser(nextUser);
    return { ...data, user: nextUser };
  }, [setToken]);

  const completePasswordResetEmail = useCallback(async (token, newPassword) => {
    const data = await apiCompletePasswordResetEmail({ token, newPassword });
    const { user: u, token: newToken, refreshToken } = data;
    setToken(newToken, refreshToken);
    const nextUser = normalizeUser(u);
    setUser(nextUser);
    return { ...data, user: nextUser };
  }, [setToken]);

  const register = useCallback(async (businessName, email, phoneNumber, password) => {
    const { user: u, token: newToken, refreshToken } = await apiRegister({
      businessName,
      email,
      phoneNumber,
      password,
    });
    setToken(newToken, refreshToken);
    const nextUser = normalizeUser(u);
    setUser(nextUser);
    return nextUser;
  }, [setToken]);

  const logout = useCallback(async ({ skipServer = false } = {}) => {
    if (!skipServer) {
      await logoutApi();
    }
    setUser(null);
    setTokenState(null);
    clearChartCache();
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    verifyTwoFactorLogin,
    completePasswordReset2fa,
    completePasswordResetEmail,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
