import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError, WatsonAuth } from '../src/client'
import { jsonResponse, makeJwt, makeJwtExpiringIn } from './helpers'

const BASE_URL = 'https://watsonauth.test'
const APP_SLUG = 'my-app'

function makeAuth(opts: Partial<ConstructorParameters<typeof WatsonAuth>[0]> = {}) {
    return new WatsonAuth({
        baseUrl: BASE_URL,
        appSlug: APP_SLUG,
        autoRefresh: false,
        ...opts,
    })
}

// Wait for the constructor's `void this.restoreSession()` microtask to resolve.
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0))

describe('WatsonAuth client', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    describe('constructor', () => {
        it('strips trailing slash from baseUrl', async () => {
            const auth = new WatsonAuth({
                baseUrl: 'https://watsonauth.test/',
                appSlug: APP_SLUG,
                autoRefresh: false,
            })
            fetchMock.mockResolvedValue(jsonResponse({ message: 'ok' }))
            await auth.forgotPassword('a@b.com')
            expect(fetchMock).toHaveBeenCalledWith(
                'https://watsonauth.test/api/auth/forgot-password',
                expect.anything()
            )
        })
    })

    describe('login', () => {
        it('returns user and stores token on success', async () => {
            const token = makeJwtExpiringIn(900)
            fetchMock.mockResolvedValue(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: 'A', emailVerified: true },
                    accessToken: token,
                    expiresIn: 900,
                })
            )

            const auth = makeAuth()
            const result = await auth.login('a@b.com', 'pw')

            expect(result.accessToken).toBe(token)
            expect(result.user.email).toBe('a@b.com')
            expect(auth.isAuthenticated()).toBe(true)

            const [url, init] = fetchMock.mock.calls[0]
            expect(url).toBe(`${BASE_URL}/api/auth/login`)
            expect(init.method).toBe('POST')
            expect(init.credentials).toBe('include')
            expect(JSON.parse(init.body)).toEqual({
                email: 'a@b.com',
                password: 'pw',
                appSlug: APP_SLUG,
            })
        })

        it('throws AuthError with server code/message on failure', async () => {
            fetchMock.mockResolvedValue(
                jsonResponse(
                    { code: 'invalid_credentials', message: 'Bad password' },
                    { status: 401 }
                )
            )
            const auth = makeAuth()
            await expect(auth.login('a@b.com', 'pw')).rejects.toMatchObject({
                name: 'AuthError',
                code: 'invalid_credentials',
                message: 'Bad password',
            })
        })

        it('throws AuthError with defaults when server returns unparseable body', async () => {
            fetchMock.mockResolvedValue(new Response('not json', { status: 500 }))
            const auth = makeAuth()
            await expect(auth.login('a@b.com', 'pw')).rejects.toMatchObject({
                code: 'login_failed',
                message: 'Login failed',
            })
        })

        it('includes details when provided', async () => {
            fetchMock.mockResolvedValue(
                jsonResponse(
                    {
                        code: 'validation_error',
                        message: 'Invalid',
                        details: { email: 'required' },
                    },
                    { status: 400 }
                )
            )
            const auth = makeAuth()
            await expect(auth.login('', '')).rejects.toMatchObject({
                details: { email: 'required' },
            })
        })
    })

    describe('register', () => {
        it('sends email/password/name/appSlug', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ message: 'check email' }))
            const auth = makeAuth()
            const result = await auth.register('a@b.com', 'pw', 'Alice')

            expect(result).toEqual({ message: 'check email' })
            const [url, init] = fetchMock.mock.calls[0]
            expect(url).toBe(`${BASE_URL}/api/auth/register`)
            expect(JSON.parse(init.body)).toEqual({
                email: 'a@b.com',
                password: 'pw',
                name: 'Alice',
                appSlug: APP_SLUG,
            })
        })

        it('throws AuthError on non-ok response', async () => {
            fetchMock.mockResolvedValue(
                jsonResponse({ code: 'email_taken', message: 'Email already used' }, { status: 409 })
            )
            const auth = makeAuth()
            await expect(auth.register('a@b.com', 'pw')).rejects.toMatchObject({
                code: 'email_taken',
            })
        })
    })

    describe('logout', () => {
        it('calls logout endpoint, clears session, and notifies listeners', async () => {
            const token = makeJwtExpiringIn(900)
            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: token,
                    expiresIn: 900,
                })
            )

            const auth = makeAuth()
            await auth.login('a@b.com', 'pw')
            expect(auth.isAuthenticated()).toBe(true)

            const listener = vi.fn()
            auth.onAuthStateChange(listener)

            fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }))
            await auth.logout()

            expect(fetchMock).toHaveBeenLastCalledWith(
                `${BASE_URL}/api/auth/logout`,
                expect.objectContaining({ method: 'POST', credentials: 'include' })
            )
            expect(auth.isAuthenticated()).toBe(false)
            expect(auth.getUser()).toBeNull()
            expect(listener).toHaveBeenCalledWith(null)
        })

        it('still clears local session when the network call fails', async () => {
            const token = makeJwtExpiringIn(900)
            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: token,
                    expiresIn: 900,
                })
            )
            const auth = makeAuth()
            await auth.login('a@b.com', 'pw')

            fetchMock.mockRejectedValueOnce(new Error('network down'))
            await auth.logout()
            expect(auth.isAuthenticated()).toBe(false)
        })
    })

    describe('forgotPassword / resetPassword / verifyEmail', () => {
        it('forgotPassword returns parsed JSON', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ message: 'sent' }))
            const result = await makeAuth().forgotPassword('a@b.com')
            expect(result).toEqual({ message: 'sent' })
        })

        it('resetPassword throws AuthError on failure', async () => {
            fetchMock.mockResolvedValue(
                jsonResponse({ code: 'token_expired', message: 'Token expired' }, { status: 400 })
            )
            await expect(makeAuth().resetPassword('tok', 'newpw')).rejects.toMatchObject({
                code: 'token_expired',
            })
        })

        it('verifyEmail throws AuthError on failure', async () => {
            fetchMock.mockResolvedValue(
                jsonResponse({ code: 'token_invalid', message: 'Invalid token' }, { status: 400 })
            )
            await expect(makeAuth().verifyEmail('tok')).rejects.toMatchObject({
                code: 'token_invalid',
            })
        })

        it('verifyEmail returns message on success', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ message: 'verified' }))
            const result = await makeAuth().verifyEmail('tok')
            expect(result).toEqual({ message: 'verified' })
        })
    })

    describe('getAccessToken', () => {
        it('returns null when no token stored', async () => {
            const auth = makeAuth()
            await flushMicrotasks()
            expect(await auth.getAccessToken()).toBeNull()
        })

        it('returns the token when still far from expiry', async () => {
            const token = makeJwtExpiringIn(900)
            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: token,
                    expiresIn: 900,
                })
            )
            const auth = makeAuth()
            await auth.login('a@b.com', 'pw')
            expect(await auth.getAccessToken()).toBe(token)
        })

        it('triggers refresh when within threshold', async () => {
            const expiring = makeJwtExpiringIn(10)
            const fresh = makeJwtExpiringIn(900)

            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: expiring,
                    expiresIn: 10,
                })
            )
            const auth = makeAuth({ refreshThreshold: 60 })
            await auth.login('a@b.com', 'pw')

            fetchMock.mockResolvedValueOnce(
                jsonResponse({ accessToken: fresh, expiresIn: 900 })
            )
            expect(await auth.getAccessToken()).toBe(fresh)
            expect(fetchMock).toHaveBeenCalledWith(
                `${BASE_URL}/api/auth/refresh`,
                expect.objectContaining({ method: 'POST', credentials: 'include' })
            )
        })

        it('deduplicates concurrent refresh calls', async () => {
            const expiring = makeJwtExpiringIn(10)
            const fresh = makeJwtExpiringIn(900)

            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: expiring,
                    expiresIn: 10,
                })
            )
            const auth = makeAuth()
            await auth.login('a@b.com', 'pw')

            // One refresh response for all concurrent callers
            fetchMock.mockResolvedValueOnce(
                jsonResponse({ accessToken: fresh, expiresIn: 900 })
            )

            const [a, b, c] = await Promise.all([
                auth.getAccessToken(),
                auth.getAccessToken(),
                auth.getAccessToken(),
            ])
            expect(a).toBe(fresh)
            expect(b).toBe(fresh)
            expect(c).toBe(fresh)
            // login + single refresh = 2 calls
            expect(fetchMock).toHaveBeenCalledTimes(2)
        })

        it('returns existing token on refresh network error', async () => {
            const expiring = makeJwtExpiringIn(10)
            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: expiring,
                    expiresIn: 10,
                })
            )
            const auth = makeAuth()
            await auth.login('a@b.com', 'pw')

            fetchMock.mockRejectedValueOnce(new Error('network down'))
            expect(await auth.getAccessToken()).toBe(expiring)
        })

        it('clears session when refresh returns a session-expiry code', async () => {
            const expiring = makeJwtExpiringIn(10)
            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: expiring,
                    expiresIn: 10,
                })
            )
            const auth = makeAuth()
            await auth.login('a@b.com', 'pw')

            const listener = vi.fn()
            auth.onAuthStateChange(listener)

            fetchMock.mockResolvedValueOnce(
                jsonResponse({ code: 'session_revoked' }, { status: 401 })
            )
            expect(await auth.getAccessToken()).toBeNull()
            expect(auth.isAuthenticated()).toBe(false)
            expect(listener).toHaveBeenCalledWith(null)
        })

        it('retries with backoff on server_error', async () => {
            vi.useFakeTimers()
            const expiring = makeJwtExpiringIn(10)
            const fresh = makeJwtExpiringIn(900)

            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: expiring,
                    expiresIn: 10,
                })
            )
            const auth = makeAuth()
            await auth.login('a@b.com', 'pw')

            fetchMock.mockResolvedValueOnce(
                jsonResponse({ code: 'server_error' }, { status: 500 })
            )
            fetchMock.mockResolvedValueOnce(
                jsonResponse({ accessToken: fresh, expiresIn: 900 })
            )

            const promise = auth.getAccessToken()
            // advance past first backoff (1000ms)
            await vi.advanceTimersByTimeAsync(1_500)
            expect(await promise).toBe(fresh)
        })
    })

    describe('getUser / isAuthenticated', () => {
        it('decodes user info from stored JWT', async () => {
            const token = makeJwt({
                sub: 'user_42',
                email: 'x@y.com',
                name: 'Xavier',
                emailVerified: true,
                exp: Math.floor(Date.now() / 1000) + 900,
            })
            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'user_42', email: 'x@y.com', name: 'Xavier', emailVerified: true },
                    accessToken: token,
                    expiresIn: 900,
                })
            )
            const auth = makeAuth()
            await auth.login('x@y.com', 'pw')

            expect(auth.getUser()).toEqual({
                id: 'user_42',
                email: 'x@y.com',
                name: 'Xavier',
                emailVerified: true,
            })
            expect(auth.isAuthenticated()).toBe(true)
        })

        it('returns null user and false auth when no token', async () => {
            const auth = makeAuth()
            await flushMicrotasks()
            expect(auth.getUser()).toBeNull()
            expect(auth.isAuthenticated()).toBe(false)
        })
    })

    describe('onAuthStateChange', () => {
        it('fires on login and logout; unsubscribe stops further events', async () => {
            const token = makeJwtExpiringIn(900)
            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: token,
                    expiresIn: 900,
                })
            )
            const auth = makeAuth()
            const listener = vi.fn()
            const unsubscribe = auth.onAuthStateChange(listener)

            await auth.login('a@b.com', 'pw')
            expect(listener).toHaveBeenCalledTimes(1)
            // user is decoded from the JWT payload, not the login input
            expect(listener.mock.calls[0][0]).toMatchObject({ email: 'alice@example.com' })

            unsubscribe()
            fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }))
            await auth.logout()
            expect(listener).toHaveBeenCalledTimes(1)
        })
    })

    describe('storage', () => {
        it('uses provided adapter for reads and writes', async () => {
            const token = makeJwtExpiringIn(900)
            const backing: Record<string, string> = {}
            const adapter = {
                get: vi.fn((k: string) => backing[k] ?? null),
                set: vi.fn((k: string, v: string) => {
                    backing[k] = v
                }),
                remove: vi.fn((k: string) => {
                    delete backing[k]
                }),
            }

            fetchMock.mockResolvedValueOnce(
                jsonResponse({
                    user: { id: 'u1', email: 'a@b.com', name: null, emailVerified: true },
                    accessToken: token,
                    expiresIn: 900,
                })
            )
            const auth = makeAuth({ storage: adapter })
            await auth.login('a@b.com', 'pw')

            expect(adapter.set).toHaveBeenCalledWith('watsonauth_access_token', token)
            expect(backing['watsonauth_access_token']).toBe(token)

            fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }))
            await auth.logout()
            expect(adapter.remove).toHaveBeenCalledWith('watsonauth_access_token')
        })

        it('restores a valid token from storage on construction', async () => {
            const token = makeJwtExpiringIn(900)
            const adapter = {
                get: vi.fn(() => token),
                set: vi.fn(),
                remove: vi.fn(),
            }
            const auth = makeAuth({ storage: adapter })
            await flushMicrotasks()
            expect(auth.isAuthenticated()).toBe(true)
            expect(auth.getUser()?.email).toBe('alice@example.com')
        })

        it('discards an expired token from storage on construction', async () => {
            const token = makeJwtExpiringIn(-10)
            const adapter = {
                get: vi.fn(() => token),
                set: vi.fn(),
                remove: vi.fn(),
            }
            const auth = makeAuth({ storage: adapter })
            await flushMicrotasks()
            expect(auth.isAuthenticated()).toBe(false)
            expect(adapter.remove).toHaveBeenCalledWith('watsonauth_access_token')
        })

        it('discards an unparseable token from storage', async () => {
            const adapter = {
                get: vi.fn(() => 'not-a-jwt'),
                set: vi.fn(),
                remove: vi.fn(),
            }
            const auth = makeAuth({ storage: adapter })
            await flushMicrotasks()
            expect(auth.isAuthenticated()).toBe(false)
            expect(adapter.remove).toHaveBeenCalledWith('watsonauth_access_token')
        })
    })

    describe('handleCallback', () => {
        it('returns null when no token param is present', async () => {
            const original = window.location
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: new URL('https://app.test/callback'),
            })
            try {
                const auth = makeAuth()
                expect(await auth.handleCallback()).toBeNull()
            } finally {
                Object.defineProperty(window, 'location', {
                    configurable: true,
                    value: original,
                })
            }
        })

        it('applies the token and returns user', async () => {
            const token = makeJwtExpiringIn(900)
            const original = window.location
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: new URL(`https://app.test/callback?token=${token}&expiresIn=900`),
            })
            try {
                const auth = makeAuth()
                const result = await auth.handleCallback()
                expect(result?.accessToken).toBe(token)
                expect(result?.user.email).toBe('alice@example.com')
                expect(auth.isAuthenticated()).toBe(true)
            } finally {
                Object.defineProperty(window, 'location', {
                    configurable: true,
                    value: original,
                })
            }
        })
    })

    describe('AuthError', () => {
        it('sets name, code, message, details', () => {
            const err = new AuthError({
                code: 'x',
                message: 'm',
                details: { foo: 'bar' },
            })
            expect(err).toBeInstanceOf(Error)
            expect(err.name).toBe('AuthError')
            expect(err.code).toBe('x')
            expect(err.message).toBe('m')
            expect(err.details).toEqual({ foo: 'bar' })
        })
    })
})
