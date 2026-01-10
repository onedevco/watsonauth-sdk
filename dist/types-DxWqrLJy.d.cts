interface User {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
}
interface TokenPayload {
    sub: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    appId: string;
    iss: string;
    aud: string;
    exp: number;
    iat: number;
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
interface LoginResult {
    user: User;
    accessToken: string;
}
interface RegisterResult {
    user: User;
    message: string;
}
interface MessageResult {
    message: string;
}
interface RedirectOptions {
    redirectUri: string;
    state?: string;
}
interface CallbackResult {
    user: User;
    accessToken: string;
}
type AuthStateCallback = (user: User | null) => void;

export type { AuthStateCallback as A, CallbackResult as C, LoginResult as L, MessageResult as M, RegisterResult as R, StorageAdapter as S, TokenPayload as T, User as U, WatsonAuthConfig as W, RedirectOptions as a };
