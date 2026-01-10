import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { WatsonAuth } from './client';
import type { User, WatsonAuthConfig } from './types';

interface WatsonAuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  client: WatsonAuth;
}

const WatsonAuthContext = createContext<WatsonAuthContextValue | null>(null);

export interface WatsonAuthProviderProps extends Omit<WatsonAuthConfig, 'onAuthStateChange'> {
  children: ReactNode;
}

export function WatsonAuthProvider({
  children,
  ...config
}: WatsonAuthProviderProps): ReactNode {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = useMemo(() => {
    return new WatsonAuth({
      ...config,
      onAuthStateChange: (newUser) => {
        setUser(newUser);
        setIsLoading(false);
      },
    });
  }, [config.baseUrl, config.appSlug]);

  useEffect(() => {
    return () => {
      client.destroy();
    };
  }, [client]);

  const login = useCallback(
    async (email: string, password: string) => {
      await client.login(email, password);
    },
    [client]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      await client.register(email, password, name);
    },
    [client]
  );

  const logout = useCallback(async () => {
    await client.logout();
  }, [client]);

  const forgotPassword = useCallback(
    async (email: string) => {
      await client.forgotPassword(email);
    },
    [client]
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      await client.resetPassword(token, newPassword);
    },
    [client]
  );

  const verifyEmail = useCallback(
    async (token: string) => {
      await client.verifyEmail(token);
    },
    [client]
  );

  const getAccessToken = useCallback(async () => {
    return client.getAccessToken();
  }, [client]);

  const value: WatsonAuthContextValue = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      verifyEmail,
      getAccessToken,
      client,
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      verifyEmail,
      getAccessToken,
      client,
    ]
  );

  return (
    <WatsonAuthContext.Provider value={value}>
      {children}
    </WatsonAuthContext.Provider>
  );
}

export function useWatsonAuth(): WatsonAuthContextValue {
  const context = useContext(WatsonAuthContext);
  if (!context) {
    throw new Error('useWatsonAuth must be used within a WatsonAuthProvider');
  }
  return context;
}

export { WatsonAuth } from './client';
export { AuthError } from './errors';
export type {
  User,
  WatsonAuthConfig,
  TokenPayload,
  StorageAdapter,
  LoginResult,
  RegisterResult,
  MessageResult,
} from './types';
