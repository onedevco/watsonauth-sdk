import { ReactNode } from 'react';
import { WatsonAuth } from './index.js';
export { AuthError } from './index.js';
import { W as WatsonAuthConfig, U as User } from './types-DxWqrLJy.js';
export { L as LoginResult, M as MessageResult, R as RegisterResult, S as StorageAdapter, T as TokenPayload } from './types-DxWqrLJy.js';

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
interface WatsonAuthProviderProps extends Omit<WatsonAuthConfig, 'onAuthStateChange'> {
    children: ReactNode;
}
declare function WatsonAuthProvider({ children, ...config }: WatsonAuthProviderProps): ReactNode;
declare function useWatsonAuth(): WatsonAuthContextValue;

export { User, WatsonAuth, WatsonAuthConfig, WatsonAuthProvider, type WatsonAuthProviderProps, useWatsonAuth };
