interface User {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
}
interface StorageAdapter {
    get(key: string): string | null | Promise<string | null>;
    set(key: string, value: string): void | Promise<void>;
    remove(key: string): void | Promise<void>;
}
interface WatsonAuthConfig {
    baseUrl: string;
    appSlug: string;
    autoRefresh?: boolean;
    refreshThreshold?: number;
    storage?: 'memory' | 'localStorage' | 'sessionStorage' | StorageAdapter;
    onAuthStateChange?: (user: User | null) => void;
}
declare class AuthError extends Error {
    code: string;
    details?: object;
    constructor({ code, message, details }: {
        code: string;
        message: string;
        details?: object;
    });
}
declare class WatsonAuth {
    private readonly baseUrl;
    private readonly appSlug;
    private readonly autoRefresh;
    private readonly refreshThreshold;
    private readonly store;
    private readonly configStateCallback?;
    private accessToken;
    private refreshTimer;
    private refreshPromise;
    private listeners;
    private sessionGeneration;
    constructor(config: WatsonAuthConfig);
    login(email: string, password: string): Promise<{
        user: User;
        accessToken: string;
    }>;
    register(email: string, password: string, name?: string): Promise<{
        message: string;
    }>;
    logout(): Promise<void>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    getAccessToken(): Promise<string | null>;
    getUser(): User | null;
    isAuthenticated(): boolean;
    onAuthStateChange(callback: (user: User | null) => void): () => void;
    redirectToLogin(opts: {
        redirectUri: string;
        state?: string;
    }): void;
    handleCallback(): Promise<{
        user: User;
        accessToken: string;
    } | null>;
    private restoreSession;
    private applyToken;
    private scheduleRefresh;
    private startRefresh;
    private performRefresh;
    private clearSession;
    private cancelTimer;
    private notify;
}

export { AuthError, type StorageAdapter, type User, WatsonAuth, type WatsonAuthConfig };
