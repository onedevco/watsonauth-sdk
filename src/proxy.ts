import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const JWKS = createRemoteJWKSet(new URL('/.well-known/jwks.json', process.env.WATSON_AUTH_URL!))

// Prevents concurrent refresh calls within the same Node.js process.
// Effective when Next.js runs in Node.js runtime. Edge runtime is stateless —
// each request is isolated so this has no effect there. For Edge, use an
// external lock (e.g. Upstash Redis) if concurrent refresh protection matters.
let refreshInFlight: Promise<RefreshResult | null> | null = null

export interface WatsonAuthDebugEvent {
    action: 'allow' | 'refresh' | 'redirect'
    path: string
    userId?: string
    /** Unix seconds — when the current access token expires */
    tokenExpiresAt?: number
    /** Date.now() value — when the last refresh completed */
    refreshedAt?: number
    reason?: 'no_token' | 'no_refresh_token' | 'refresh_failed' | 'jwt_invalid'
}

interface RefreshResult {
    accessToken: string
    refreshToken: string
    expiresIn: number
    userId: string
}

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

function isNearExpiry(token: string, thresholdSeconds = 60): boolean {
    const payload = decodeJwtPayload(token)
    if (!payload || typeof payload.exp !== 'number') return true
    return payload.exp - Date.now() / 1000 < thresholdSeconds
}

async function refreshTokens(refreshToken: string): Promise<RefreshResult | null> {
    if (!refreshInFlight) {
        refreshInFlight = _performRefresh(refreshToken).finally(() => {
            refreshInFlight = null
        })
    }
    return refreshInFlight
}

async function _performRefresh(refreshToken: string): Promise<RefreshResult | null> {
    try {
        const res = await fetch(`${process.env.WATSON_AUTH_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                Cookie: `watson_refresh_token=${refreshToken}`,
            },
        })

        if (!res.ok) return null

        const data = await res.json() as {
            accessToken: string
            refreshToken: string
            expiresIn: number
        }

        const payload = decodeJwtPayload(data.accessToken)
        if (!payload) return null

        return { ...data, userId: payload.sub as string }
    } catch {
        return null
    }
}

function applyRefreshedTokens(response: NextResponse, result: RefreshResult): void {
    const secure = process.env.NODE_ENV === 'production'
    response.cookies.set('access_token', result.accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: result.expiresIn,
        path: '/',
    })
    response.cookies.set('watson_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
    })
}

function redirectToLogin(): NextResponse {
    const loginUrl = new URL('/login', process.env.WATSON_AUTH_URL)
    loginUrl.searchParams.set('app', process.env.WATSON_AUTH_APP_SLUG!)
    loginUrl.searchParams.set('callback', `${process.env.NEXT_PUBLIC_APP_URL}/callback`)
    return NextResponse.redirect(loginUrl)
}

function setDebugCookie(response: NextResponse, event: WatsonAuthDebugEvent): void {
    response.cookies.set('watson_auth_debug', JSON.stringify(event), {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60,
    })
}

export function createWatsonAuthProxy({
    initPublicPaths = [],
    debug,
}: {
    initPublicPaths?: string[]
    debug?: boolean | ((event: WatsonAuthDebugEvent) => void)
}) {
    const publicPaths = ['/login', '/callback', ...initPublicPaths]

    const log = debug
        ? (event: WatsonAuthDebugEvent) => {
            if (typeof debug === 'function') debug(event)
            else console.log('[WatsonAuth]', JSON.stringify(event))
          }
        : null

    function emit(response: NextResponse, event: WatsonAuthDebugEvent): NextResponse {
        if (!log) return response
        log(event)
        setDebugCookie(response, event)
        return response
    }

    function loginRedirect(event: WatsonAuthDebugEvent): NextResponse {
        return emit(redirectToLogin(), event)
    }

    return async (request: NextRequest) => {
        const { pathname } = request.nextUrl

        if (publicPaths.some((p) => p.endsWith('/') ? pathname.startsWith(p) : pathname === p)) {
            return NextResponse.next()
        }

        const token = request.cookies.get('access_token')?.value
        if (!token) {
            return loginRedirect({ action: 'redirect', path: pathname, reason: 'no_token' })
        }

        // Proactive refresh: rotate before the request reaches any handler
        // so downstream code always gets a valid token in x-user-id / cookies
        if (isNearExpiry(token)) {
            const currentRefreshToken = request.cookies.get('watson_refresh_token')?.value
            if (!currentRefreshToken) {
                return loginRedirect({ action: 'redirect', path: pathname, reason: 'no_refresh_token' })
            }

            const result = await refreshTokens(currentRefreshToken)
            if (!result) {
                return loginRedirect({ action: 'redirect', path: pathname, reason: 'refresh_failed' })
            }

            const requestHeaders = new Headers(request.headers)
            requestHeaders.set('x-user-id', result.userId)
            const response = NextResponse.next({ request: { headers: requestHeaders } })
            applyRefreshedTokens(response, result)
            return emit(response, {
                action: 'refresh',
                path: pathname,
                userId: result.userId,
                tokenExpiresAt: Math.floor(Date.now() / 1000) + result.expiresIn,
                refreshedAt: Date.now(),
            })
        }

        // Full JWT verification for tokens not near expiry
        try {
            const { payload } = await jwtVerify(token, JWKS, {
                issuer: process.env.WATSON_AUTH_URL,
            })
            const requestHeaders = new Headers(request.headers)
            requestHeaders.set('x-user-id', payload.sub as string)
            const response = NextResponse.next({ request: { headers: requestHeaders } })
            return emit(response, {
                action: 'allow',
                path: pathname,
                userId: payload.sub as string,
                tokenExpiresAt: payload.exp as number,
            })
        } catch {
            // Verification failed — token may have expired in the window between
            // the isNearExpiry check and here. Attempt refresh before giving up.
            const currentRefreshToken = request.cookies.get('watson_refresh_token')?.value
            if (!currentRefreshToken) {
                return loginRedirect({ action: 'redirect', path: pathname, reason: 'jwt_invalid' })
            }

            const result = await refreshTokens(currentRefreshToken)
            if (!result) {
                return loginRedirect({ action: 'redirect', path: pathname, reason: 'refresh_failed' })
            }

            const requestHeaders = new Headers(request.headers)
            requestHeaders.set('x-user-id', result.userId)
            const response = NextResponse.next({ request: { headers: requestHeaders } })
            applyRefreshedTokens(response, result)
            return emit(response, {
                action: 'refresh',
                path: pathname,
                userId: result.userId,
                tokenExpiresAt: Math.floor(Date.now() / 1000) + result.expiresIn,
                refreshedAt: Date.now(),
            })
        }
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
