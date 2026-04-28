import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { jsonResponse, makeJwtExpiringIn } from './helpers'

vi.mock('jose', async () => {
    const actual = await vi.importActual<typeof import('jose')>('jose')
    return {
        ...actual,
        createRemoteJWKSet: vi.fn(() => ({})),
        jwtVerify: vi.fn(),
    }
})

import { jwtVerify } from 'jose'
import { createWatsonAuthProxy } from '../src/proxy'

const WATSON_URL = process.env.WATSON_AUTH_URL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

function makeRequest(
    pathname: string,
    cookies: Record<string, string> = {}
): NextRequest {
    const req = new NextRequest(`${APP_URL}${pathname}`)
    for (const [name, value] of Object.entries(cookies)) {
        req.cookies.set(name, value)
    }
    return req
}

/**
 * NextResponse.next() sets x-middleware-next: 1.
 * NextResponse.redirect() returns a 307 with Location.
 */
function isNext(res: Response): boolean {
    return res.headers.get('x-middleware-next') === '1'
}

function isRedirectToLogin(res: Response): boolean {
    const loc = res.headers.get('location')
    return (
        res.status === 307 &&
        !!loc &&
        loc.startsWith(`${WATSON_URL}/login`) &&
        loc.includes(`app=${process.env.WATSON_AUTH_APP_SLUG}`) &&
        loc.includes(encodeURIComponent(`${APP_URL}/callback`))
    )
}

describe('createWatsonAuthProxy', () => {
    let fetchMock: ReturnType<typeof vi.fn>
    const proxy = createWatsonAuthProxy({ initPublicPaths: ['/about', '/pricing'] })

    beforeEach(() => {
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        vi.mocked(jwtVerify).mockReset()
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('public paths', () => {
        it('bypasses auth for the built-in /login path', async () => {
            const res = await proxy(makeRequest('/login'))
            expect(isNext(res)).toBe(true)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(jwtVerify).not.toHaveBeenCalled()
        })

        it('bypasses auth for the built-in /callback path', async () => {
            const res = await proxy(makeRequest('/callback'))
            expect(isNext(res)).toBe(true)
        })

        it('bypasses auth for configured initPublicPaths', async () => {
            expect(isNext(await proxy(makeRequest('/about')))).toBe(true)
            expect(isNext(await proxy(makeRequest('/pricing')))).toBe(true)
        })
    })

    describe('no token', () => {
        it('redirects to login when both cookies are missing', async () => {
            const res = await proxy(makeRequest('/dashboard'))
            expect(isRedirectToLogin(res)).toBe(true)
        })

        it('refreshes using watson_refresh_token when access_token is missing', async () => {
            const newAccess = makeJwtExpiringIn(900, { sub: 'user_restored' })
            fetchMock.mockResolvedValue(
                jsonResponse({ accessToken: newAccess, refreshToken: 'new-rt', expiresIn: 900 })
            )

            const res = await proxy(makeRequest('/dashboard', { watson_refresh_token: 'old-rt' }))

            expect(isNext(res)).toBe(true)
            expect(res.cookies.get('access_token')?.value).toBe(newAccess)
            expect(res.cookies.get('watson_refresh_token')?.value).toBe('new-rt')
            expect(res.headers.get('x-middleware-request-x-user-id')).toBe('user_restored')
        })

        it('redirects to login when access_token is missing and refresh fails', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ code: 'invalid' }, { status: 401 }))

            const res = await proxy(makeRequest('/dashboard', { watson_refresh_token: 'old-rt' }))

            expect(isRedirectToLogin(res)).toBe(true)
        })
    })

    describe('valid token (not near expiry)', () => {
        it('verifies the JWT, forwards x-user-id, and continues', async () => {
            const token = makeJwtExpiringIn(900, { sub: 'user_99' })
            vi.mocked(jwtVerify).mockResolvedValue({
                payload: { sub: 'user_99' },
                protectedHeader: { alg: 'RS256' },
            } as any)

            const res = await proxy(
                makeRequest('/dashboard', { access_token: token })
            )
            expect(isNext(res)).toBe(true)
            expect(jwtVerify).toHaveBeenCalledOnce()
            expect(fetchMock).not.toHaveBeenCalled()

            // x-user-id is attached to the forwarded request headers
            const forwardedHeaders = res.headers.get('x-middleware-override-headers')
            expect(forwardedHeaders ?? '').toContain('x-user-id')
            expect(res.headers.get('x-middleware-request-x-user-id')).toBe('user_99')
        })
    })

    describe('token near expiry', () => {
        it('refreshes tokens when access token is near expiry and forwards new cookies', async () => {
            const nearExpiryAccess = makeJwtExpiringIn(10)
            const newAccess = makeJwtExpiringIn(900, { sub: 'user_42' })

            fetchMock.mockResolvedValue(
                jsonResponse({
                    accessToken: newAccess,
                    refreshToken: 'rotated-refresh',
                    expiresIn: 900,
                })
            )

            const res = await proxy(
                makeRequest('/dashboard', {
                    access_token: nearExpiryAccess,
                    watson_refresh_token: 'old-refresh',
                })
            )

            expect(isNext(res)).toBe(true)
            expect(fetchMock).toHaveBeenCalledWith(
                `${WATSON_URL}/api/auth/refresh`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Cookie: 'watson_refresh_token=old-refresh',
                    }),
                })
            )

            const access = res.cookies.get('access_token')
            expect(access?.value).toBe(newAccess)
            expect(access?.path).toBe('/')

            const refresh = res.cookies.get('watson_refresh_token')
            expect(refresh?.value).toBe('rotated-refresh')
            expect(refresh?.path).toBe('/')

            // Derived user id flows through from the new access token
            expect(res.headers.get('x-middleware-request-x-user-id')).toBe('user_42')
        })

        it('redirects to login when refresh cookie is missing', async () => {
            const nearExpiryAccess = makeJwtExpiringIn(10)
            const res = await proxy(
                makeRequest('/dashboard', { access_token: nearExpiryAccess })
            )
            expect(isRedirectToLogin(res)).toBe(true)
            expect(fetchMock).not.toHaveBeenCalled()
        })

        it('redirects to login when refresh endpoint returns non-ok', async () => {
            const nearExpiryAccess = makeJwtExpiringIn(10)
            fetchMock.mockResolvedValue(
                jsonResponse({ code: 'token_invalid' }, { status: 401 })
            )
            const res = await proxy(
                makeRequest('/dashboard', {
                    access_token: nearExpiryAccess,
                    watson_refresh_token: 'old-refresh',
                })
            )
            expect(isRedirectToLogin(res)).toBe(true)
        })

        it('redirects to login when refresh fetch throws', async () => {
            const nearExpiryAccess = makeJwtExpiringIn(10)
            fetchMock.mockRejectedValue(new Error('network'))
            const res = await proxy(
                makeRequest('/dashboard', {
                    access_token: nearExpiryAccess,
                    watson_refresh_token: 'old-refresh',
                })
            )
            expect(isRedirectToLogin(res)).toBe(true)
        })
    })

    describe('JWT verification fails', () => {
        it('attempts refresh when verification throws', async () => {
            const token = makeJwtExpiringIn(900)
            vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid signature'))

            const newAccess = makeJwtExpiringIn(900, { sub: 'user_1' })
            fetchMock.mockResolvedValue(
                jsonResponse({
                    accessToken: newAccess,
                    refreshToken: 'rotated',
                    expiresIn: 900,
                })
            )

            const res = await proxy(
                makeRequest('/dashboard', {
                    access_token: token,
                    watson_refresh_token: 'old-refresh',
                })
            )
            expect(isNext(res)).toBe(true)
            expect(res.cookies.get('access_token')?.value).toBe(newAccess)
        })

        it('redirects to login when verification fails and no refresh token exists', async () => {
            const token = makeJwtExpiringIn(900)
            vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid signature'))

            const res = await proxy(
                makeRequest('/dashboard', { access_token: token })
            )
            expect(isRedirectToLogin(res)).toBe(true)
        })
    })

    describe('debug mode', () => {
        it('calls the debug callback with action:allow on a valid token', async () => {
            const token = makeJwtExpiringIn(900, { sub: 'user_debug' })
            vi.mocked(jwtVerify).mockResolvedValue({
                payload: { sub: 'user_debug', exp: Math.floor(Date.now() / 1000) + 900 },
                protectedHeader: { alg: 'RS256' },
            } as any)

            const events: unknown[] = []
            const debugProxy = createWatsonAuthProxy({
                debug: (e) => events.push(e),
            })

            await debugProxy(makeRequest('/dashboard', { access_token: token }))

            expect(events).toHaveLength(1)
            expect(events[0]).toMatchObject({ action: 'allow', path: '/dashboard', userId: 'user_debug' })
        })

        it('calls the debug callback with action:refresh on a proactive refresh', async () => {
            const nearExpiry = makeJwtExpiringIn(10)
            const newAccess = makeJwtExpiringIn(900, { sub: 'user_r' })
            fetchMock.mockResolvedValue(jsonResponse({ accessToken: newAccess, refreshToken: 'rt2', expiresIn: 900 }))

            const events: unknown[] = []
            const debugProxy = createWatsonAuthProxy({ debug: (e) => events.push(e) })

            await debugProxy(makeRequest('/dashboard', {
                access_token: nearExpiry,
                watson_refresh_token: 'rt1',
            }))

            expect(events).toHaveLength(1)
            expect(events[0]).toMatchObject({
                action: 'refresh',
                path: '/dashboard',
                userId: 'user_r',
            })
            expect((events[0] as any).tokenExpiresAt).toBeGreaterThan(Date.now() / 1000)
            expect((events[0] as any).refreshedAt).toBeGreaterThan(0)
        })

        it('calls the debug callback with action:redirect and reason on missing token', async () => {
            const events: unknown[] = []
            const debugProxy = createWatsonAuthProxy({ debug: (e) => events.push(e) })

            const res = await debugProxy(makeRequest('/dashboard'))

            expect(isRedirectToLogin(res)).toBe(true)
            expect(events).toHaveLength(1)
            expect(events[0]).toMatchObject({ action: 'redirect', path: '/dashboard', reason: 'no_token' })
        })

        it('calls the debug callback with reason:no_refresh_token when near-expiry token has no refresh cookie', async () => {
            const events: unknown[] = []
            const debugProxy = createWatsonAuthProxy({ debug: (e) => events.push(e) })

            const res = await debugProxy(makeRequest('/dashboard', { access_token: makeJwtExpiringIn(10) }))

            expect(isRedirectToLogin(res)).toBe(true)
            expect(events[0]).toMatchObject({ action: 'redirect', reason: 'no_refresh_token' })
        })

        it('calls the debug callback with reason:refresh_failed when refresh endpoint fails', async () => {
            const events: unknown[] = []
            const debugProxy = createWatsonAuthProxy({ debug: (e) => events.push(e) })
            fetchMock.mockResolvedValue(jsonResponse({ code: 'invalid' }, { status: 401 }))

            const res = await debugProxy(makeRequest('/dashboard', {
                access_token: makeJwtExpiringIn(10),
                watson_refresh_token: 'rt',
            }))

            expect(isRedirectToLogin(res)).toBe(true)
            expect(events[0]).toMatchObject({ action: 'redirect', reason: 'refresh_failed' })
        })

        it('sets a readable watson_auth_debug cookie on the response', async () => {
            const token = makeJwtExpiringIn(900, { sub: 'u1' })
            vi.mocked(jwtVerify).mockResolvedValue({
                payload: { sub: 'u1', exp: Math.floor(Date.now() / 1000) + 900 },
                protectedHeader: { alg: 'RS256' },
            } as any)

            const debugProxy = createWatsonAuthProxy({ debug: true })
            const res = await debugProxy(makeRequest('/dashboard', { access_token: token }))

            const cookie = res.cookies.get('watson_auth_debug')
            expect(cookie).toBeDefined()
            expect(cookie?.httpOnly).toBe(false)
            const parsed = JSON.parse(cookie!.value)
            expect(parsed).toMatchObject({ action: 'allow', path: '/dashboard', userId: 'u1' })
        })

        it('does not set a watson_auth_debug cookie when debug is not enabled', async () => {
            const token = makeJwtExpiringIn(900, { sub: 'u1' })
            vi.mocked(jwtVerify).mockResolvedValue({
                payload: { sub: 'u1', exp: Math.floor(Date.now() / 1000) + 900 },
                protectedHeader: { alg: 'RS256' },
            } as any)

            const res = await proxy(makeRequest('/dashboard', { access_token: token }))

            expect(res.cookies.get('watson_auth_debug')).toBeUndefined()
        })
    })
})
