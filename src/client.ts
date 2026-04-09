export interface User {
    id: string
    email: string
    name: string | null
    emailVerified: boolean
}

export interface StorageAdapter {
    get(key: string): string | null | Promise<string | null>
    set(key: string, value: string): void | Promise<void>
    remove(key: string): void | Promise<void>
}

export interface WatsonAuthConfig {
    baseUrl: string
    appSlug: string
    autoRefresh?: boolean
    refreshThreshold?: number
    storage?: 'memory' | 'localStorage' | 'sessionStorage' | StorageAdapter
    onAuthStateChange?: (user: User | null) => void
}

export class AuthError extends Error {
    code: string
    details?: object

    constructor({ code, message, details }: { code: string; message: string; details?: object }) {
        super(message)
        this.name = 'AuthError'
        this.code = code
        this.details = details
    }
}

const TOKEN_KEY = 'watsonauth_access_token'

const SESSION_EXPIRY_CODES = new Set([
    'token_missing',
    'token_invalid',
    'token_reused',
    'session_revoked',
    'token_expired',
    'account_disabled',
])

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return null
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        return JSON.parse(atob(b64)) as Record<string, unknown>
    } catch {
        return null
    }
}

function buildStorage(opt: WatsonAuthConfig['storage']): StorageAdapter {
    if (!opt || opt === 'memory') {
        const store: Record<string, string> = {}
        return {
            get: (k) => store[k] ?? null,
            set: (k, v) => { store[k] = v },
            remove: (k) => { delete store[k] },
        }
    }
    if (opt === 'localStorage') {
        return {
            get: (k) => (typeof window !== 'undefined' ? localStorage.getItem(k) : null),
            set: (k, v) => { if (typeof window !== 'undefined') localStorage.setItem(k, v) },
            remove: (k) => { if (typeof window !== 'undefined') localStorage.removeItem(k) },
        }
    }
    if (opt === 'sessionStorage') {
        return {
            get: (k) => (typeof window !== 'undefined' ? sessionStorage.getItem(k) : null),
            set: (k, v) => { if (typeof window !== 'undefined') sessionStorage.setItem(k, v) },
            remove: (k) => { if (typeof window !== 'undefined') sessionStorage.removeItem(k) },
        }
    }
    return opt
}

export class WatsonAuth {
    private readonly baseUrl: string
    private readonly appSlug: string
    private readonly autoRefresh: boolean
    private readonly refreshThreshold: number
    private readonly store: StorageAdapter
    private readonly configStateCallback?: (user: User | null) => void

    private accessToken: string | null = null
    private refreshTimer: ReturnType<typeof setTimeout> | null = null
    private refreshPromise: Promise<string | null> | null = null
    private listeners = new Set<(user: User | null) => void>()
    // Incremented on logout so an in-flight refresh can detect the session changed
    private sessionGeneration = 0

    constructor(config: WatsonAuthConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '')
        this.appSlug = config.appSlug
        this.autoRefresh = config.autoRefresh ?? true
        this.refreshThreshold = config.refreshThreshold ?? 60
        this.store = buildStorage(config.storage)
        this.configStateCallback = config.onAuthStateChange

        void this.restoreSession()
    }

    // ── Auth methods ───────────────────────────────────────────────────────────

    async login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
        const res = await fetch(`${this.baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, appSlug: this.appSlug }),
        })

        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { code?: string; message?: string; details?: object }
            throw new AuthError({
                code: body.code ?? 'login_failed',
                message: body.message ?? 'Login failed',
                details: body.details,
            })
        }

        const data = await res.json() as { user: User; accessToken: string; expiresIn: number }
        await this.applyToken(data.accessToken, data.expiresIn)
        return { user: data.user, accessToken: data.accessToken }
    }

    async register(
        email: string,
        password: string,
        name?: string
    ): Promise<{ message: string }> {
        const res = await fetch(`${this.baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, appSlug: this.appSlug }),
        })

        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { code?: string; message?: string; details?: object }
            throw new AuthError({
                code: body.code ?? 'register_failed',
                message: body.message ?? 'Registration failed',
                details: body.details,
            })
        }

        return res.json() as Promise<{ message: string }>
    }

    async logout(): Promise<void> {
        this.sessionGeneration++
        this.cancelTimer()
        try {
            await fetch(`${this.baseUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            })
        } catch {
            // best-effort; local state is always cleared
        }
        await this.clearSession()
    }

    async forgotPassword(email: string): Promise<{ message: string }> {
        const res = await fetch(`${this.baseUrl}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        })
        return res.json() as Promise<{ message: string }>
    }

    async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
        const res = await fetch(`${this.baseUrl}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword }),
        })

        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { code?: string; message?: string }
            throw new AuthError({
                code: body.code ?? 'reset_failed',
                message: body.message ?? 'Password reset failed',
            })
        }

        return res.json() as Promise<{ message: string }>
    }

    async verifyEmail(token: string): Promise<{ message: string }> {
        const res = await fetch(`${this.baseUrl}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })

        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { code?: string; message?: string }
            throw new AuthError({
                code: body.code ?? 'verify_failed',
                message: body.message ?? 'Email verification failed',
            })
        }

        return res.json() as Promise<{ message: string }>
    }

    // ── Token / state accessors ────────────────────────────────────────────────

    async getAccessToken(): Promise<string | null> {
        if (!this.accessToken) return null

        // If a refresh is already running, join it instead of firing another
        if (this.refreshPromise) return this.refreshPromise

        const payload = decodeJwtPayload(this.accessToken)
        if (!payload || typeof payload.exp !== 'number') return this.accessToken

        const secondsRemaining = payload.exp - Date.now() / 1000
        if (secondsRemaining < this.refreshThreshold) {
            return this.startRefresh()
        }

        return this.accessToken
    }

    getUser(): User | null {
        if (!this.accessToken) return null
        const payload = decodeJwtPayload(this.accessToken)
        if (!payload) return null
        return {
            id: payload.sub as string,
            email: payload.email as string,
            name: (payload.name as string | null) ?? null,
            emailVerified: payload.emailVerified as boolean,
        }
    }

    isAuthenticated(): boolean {
        if (!this.accessToken) return false
        const payload = decodeJwtPayload(this.accessToken)
        if (!payload || typeof payload.exp !== 'number') return false
        return payload.exp > Date.now() / 1000
    }

    onAuthStateChange(callback: (user: User | null) => void): () => void {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    // ── Redirect flow helpers ──────────────────────────────────────────────────

    redirectToLogin(opts: { redirectUri: string; state?: string }): void {
        const url = new URL('/login', this.baseUrl)
        url.searchParams.set('app', this.appSlug)
        url.searchParams.set('callback', opts.redirectUri)
        if (opts.state) url.searchParams.set('state', opts.state)
        window.location.href = url.toString()
    }

    async handleCallback(): Promise<{ user: User; accessToken: string } | null> {
        const params = new URLSearchParams(window.location.search)
        const token = params.get('token')
        const expiresIn = Number(params.get('expiresIn') ?? 900)
        if (!token) return null
        await this.applyToken(token, expiresIn)
        return { user: this.getUser()!, accessToken: token }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private async restoreSession(): Promise<void> {
        const stored = await this.store.get(TOKEN_KEY)
        if (!stored) return

        const payload = decodeJwtPayload(stored)
        if (!payload || typeof payload.exp !== 'number') {
            await this.store.remove(TOKEN_KEY)
            return
        }

        const secondsRemaining = payload.exp - Date.now() / 1000
        if (secondsRemaining <= 0) {
            await this.store.remove(TOKEN_KEY)
            return
        }

        this.accessToken = stored
        if (this.autoRefresh) {
            // Schedule relative to remaining lifetime, not original expiresIn
            this.scheduleRefresh(secondsRemaining)
        }
        this.notify()
    }

    private async applyToken(token: string, expiresIn: number): Promise<void> {
        this.accessToken = token
        await this.store.set(TOKEN_KEY, token)
        if (this.autoRefresh) {
            this.scheduleRefresh(expiresIn)
        }
        this.notify()
    }

    private scheduleRefresh(expiresIn: number): void {
        this.cancelTimer()
        const delay = Math.max(0, (expiresIn - this.refreshThreshold) * 1000)
        this.refreshTimer = setTimeout(() => void this.startRefresh(), delay)
    }

    private startRefresh(): Promise<string | null> {
        if (!this.refreshPromise) {
            this.refreshPromise = this.performRefresh().finally(() => {
                this.refreshPromise = null
            })
        }
        return this.refreshPromise
    }

    private async performRefresh(attempt = 0): Promise<string | null> {
        const gen = this.sessionGeneration

        let res: Response
        try {
            res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            })
        } catch {
            // Network error — leave session intact
            return this.accessToken
        }

        // If logout() was called while the fetch was in-flight, discard result
        if (this.sessionGeneration !== gen) return null

        if (res.ok) {
            const data = await res.json() as { accessToken: string; expiresIn: number }
            await this.applyToken(data.accessToken, data.expiresIn)
            return data.accessToken
        }

        let code: string | undefined
        try {
            const body = await res.json() as { code?: string }
            code = body.code
        } catch {
            // ignore parse error
        }

        if (code && SESSION_EXPIRY_CODES.has(code)) {
            await this.clearSession()
            return null
        }

        if (code === 'server_error' && attempt < 3) {
            const backoff = Math.min(1000 * 2 ** attempt, 30_000)
            await new Promise<void>((resolve) => setTimeout(resolve, backoff))
            if (this.sessionGeneration !== gen) return null
            return this.performRefresh(attempt + 1)
        }

        // Unknown error — leave session intact, return current token
        return this.accessToken
    }

    private async clearSession(): Promise<void> {
        this.accessToken = null
        await this.store.remove(TOKEN_KEY)
        this.notify()
    }

    private cancelTimer(): void {
        if (this.refreshTimer !== null) {
            clearTimeout(this.refreshTimer)
            this.refreshTimer = null
        }
    }

    private notify(): void {
        const user = this.getUser()
        this.configStateCallback?.(user)
        this.listeners.forEach((fn) => fn(user))
    }
}
