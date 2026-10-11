import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, ApiError, silentRefreshSession } from '../api/client';
import { Language, Role } from '@family-milk/shared';

export interface UserProfile {
  id: string;
  familyId: string;
  familyName: string;
  name: string;
  phone: string;
  role: Role;
  languagePreference: Language;
  mustChangePin?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  registerFamily: (input: {
    familyName: string;
    ownerName: string;
    phone: string;
    pin: string;
    initialRateRupees: number;
    languagePreference: Language;
  }) => Promise<void>;
  setupPin: (newPin: string) => Promise<void>;
  logout: () => void;
  updateUserLanguage: (lang: Language) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('milk_token'));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('milk_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. If access token exists, verify it with /api/auth/me
      if (token) {
        try {
          const res = await apiRequest<{ user: UserProfile }>('/api/auth/me');
          setUser(res.user);
          localStorage.setItem('milk_user', JSON.stringify(res.user));
          setIsLoading(false);
          return;
        } catch (err: any) {
          if (err instanceof ApiError && err.status === 401) {
            // Access token expired, attempt silent cookie refresh
            const refreshed = await silentRefreshSession();
            if (refreshed) {
              setToken(refreshed.token);
              setUser(refreshed.user);
              setIsLoading(false);
              return;
            }
          }
        }
      }

      // 2. If no valid access token, attempt silent refresh via persistent HttpOnly cookie
      // (This automatically logs in users when app reopens, phone restarts, or PWA launches)
      const refreshed = await silentRefreshSession();
      if (refreshed) {
        setToken(refreshed.token);
        setUser(refreshed.user);
      } else {
        setToken(null);
        setUser(null);
        localStorage.removeItem('milk_token');
        localStorage.removeItem('milk_user');
      }

      setIsLoading(false);
    };

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('milk_token');
      localStorage.removeItem('milk_user');
    };

    window.addEventListener('milk_unauthorized', handleUnauthorized);
    checkAuth();

    return () => {
      window.removeEventListener('milk_unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (phone: string, pin: string) => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, pin }),
    });

    localStorage.setItem('milk_token', res.token);
    localStorage.setItem('milk_user', JSON.stringify(res.user));
    if (res.user.languagePreference) {
      localStorage.setItem('milk_lang', res.user.languagePreference);
      document.documentElement.lang = res.user.languagePreference;
    }
    setToken(res.token);
    setUser(res.user);
  };

  const registerFamily = async (input: {
    familyName: string;
    ownerName: string;
    phone: string;
    pin: string;
    initialRateRupees: number;
    languagePreference: Language;
  }) => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register-family', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    localStorage.setItem('milk_token', res.token);
    localStorage.setItem('milk_user', JSON.stringify(res.user));
    if (res.user.languagePreference) {
      localStorage.setItem('milk_lang', res.user.languagePreference);
      document.documentElement.lang = res.user.languagePreference;
    }
    setToken(res.token);
    setUser(res.user);
  };

  const setupPin = async (newPin: string) => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/setup-pin', {
      method: 'POST',
      body: JSON.stringify({ newPin }),
    });

    localStorage.setItem('milk_token', res.token);
    localStorage.setItem('milk_user', JSON.stringify(res.user));
    if (res.user.languagePreference) {
      localStorage.setItem('milk_lang', res.user.languagePreference);
      document.documentElement.lang = res.user.languagePreference;
    }
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
    }).catch(() => {});

    localStorage.removeItem('milk_token');
    localStorage.removeItem('milk_user');
    setToken(null);
    setUser(null);
  };

  const updateUserLanguage = async (lang: Language) => {
    if (user && token) {
      try {
        await apiRequest('/api/auth/language', {
          method: 'PATCH',
          body: JSON.stringify({ language: lang }),
        });
        const updated = { ...user, languagePreference: lang };
        setUser(updated);
        localStorage.setItem('milk_user', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to sync language to server:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        registerFamily,
        setupPin,
        logout,
        updateUserLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
