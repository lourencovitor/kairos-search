import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AtsApiError, atsApi } from '../api/client.js';
import type { UserDto } from '../api/types.js';

interface AuthContextValue {
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly user: UserDto | null;
  readonly refresh: () => Promise<void>;
  readonly logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await atsApi.getMe();
      setUser(data);
      setIsAuthenticated(true);
    } catch (err) {
      if (err instanceof AtsApiError && err.status === 401) {
        setUser(null);
        setIsAuthenticated(false);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await atsApi.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ isAuthenticated, isLoading, user, refresh, logout }),
    [isAuthenticated, isLoading, user, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
