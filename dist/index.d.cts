import { W as WatsonAuthConfig, L as LoginResult, R as RegisterResult, M as MessageResult, U as User, A as AuthStateCallback, a as RedirectOptions, C as CallbackResult } from './types-DxWqrLJy.cjs';
export { S as StorageAdapter, T as TokenPayload } from './types-DxWqrLJy.cjs';

declare class WatsonAuth {
    private baseUrl;
    private appSlug;
    private autoRefresh;
    private refreshThreshold;
    private storage;
    private listeners;
    private refreshTimer;
    private currentUser;
    constructor(config: WatsonAuthConfig);
    private initializeFromStorage;
    private request;
    private decodeToken;
    private isTokenExpired;
    private shouldRefresh;
    private payloadToUser;
    private notifyListeners;
    private scheduleRefresh;
    private tryRefresh;
    private clearAuth;
    login(email: string, password: string): Promise<LoginResult>;
    register(email: string, password: string, name?: string): Promise<RegisterResult>;
    logout(): Promise<void>;
    forgotPassword(email: string): Promise<MessageResult>;
    resetPassword(token: string, newPassword: string): Promise<MessageResult>;
    verifyEmail(token: string): Promise<MessageResult>;
    getAccessToken(): Promise<string | null>;
    getUser(): User | null;
    isAuthenticated(): boolean;
    onAuthStateChange(callback: AuthStateCallback): () => void;
    redirectToLogin(options: RedirectOptions): void;
    handleCallback(): Promise<CallbackResult>;
    destroy(): void;
}

declare class AuthError extends Error {
    code: string;
    details?: object;
    constructor(code: string, message: string, details?: object);
    static fromResponse(data: {
        code?: string;
        message?: string;
        details?: object;
    }): AuthError;
}

export { AuthError, AuthStateCallback, CallbackResult, LoginResult, MessageResult, RedirectOptions, RegisterResult, User, WatsonAuth, WatsonAuthConfig };
