import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('jose', async () => {
    const actual = await vi.importActual<typeof import('jose')>('jose')
    return {
        ...actual,
        createRemoteJWKSet: vi.fn(() => ({})),
        jwtVerify: vi.fn(),
    }
})

import { jwtVerify } from 'jose'
import { createUserGET } from '../src/userRoute'

const handler = createUserGET()

function requestWithCookies(cookies: Record<string, string>): NextRequest {
    const req = new NextRequest('https://app.test/api/me')
    for (const [name, value] of Object.entries(cookies)) {
        req.cookies.set(name, value)
    }
    return req
}

describe('createUserGET', () => {
    beforeEach(() => {
        vi.mocked(jwtVerify).mockReset()
    })
    afterEach(() => {
        vi.mocked(jwtVerify).mockReset()
    })

    it('returns 401 + null user when no access_token cookie', async () => {
        const res = await handler(requestWithCookies({}))
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ user: null })
        expect(jwtVerify).not.toHaveBeenCalled()
    })

    it('returns the decoded user when the token verifies', async () => {
        vi.mocked(jwtVerify).mockResolvedValue({
            payload: {
                sub: 'user_7',
                email: 'z@y.com',
                name: 'Zed',
                emailVerified: true,
            },
            protectedHeader: { alg: 'RS256' },
        } as any)

        const res = await handler(
            requestWithCookies({ access_token: 'whatever' })
        )
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            user: {
                id: 'user_7',
                email: 'z@y.com',
                name: 'Zed',
                emailVerified: true,
            },
        })
    })

    it('coerces missing claims to safe defaults', async () => {
        vi.mocked(jwtVerify).mockResolvedValue({
            payload: { sub: 'user_8' },
            protectedHeader: { alg: 'RS256' },
        } as any)

        const res = await handler(
            requestWithCookies({ access_token: 'whatever' })
        )
        expect(await res.json()).toEqual({
            user: {
                id: 'user_8',
                email: '',
                name: null,
                emailVerified: false,
            },
        })
    })

    it('returns 401 + null user when verification throws', async () => {
        vi.mocked(jwtVerify).mockRejectedValue(new Error('JWTExpired'))
        const res = await handler(
            requestWithCookies({ access_token: 'expired' })
        )
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ user: null })
    })

    it('passes the configured issuer to jwtVerify', async () => {
        vi.mocked(jwtVerify).mockResolvedValue({
            payload: { sub: 'u' },
            protectedHeader: { alg: 'RS256' },
        } as any)
        await handler(requestWithCookies({ access_token: 'tok' }))
        expect(jwtVerify).toHaveBeenCalledWith(
            'tok',
            expect.anything(),
            expect.objectContaining({ issuer: process.env.WATSON_AUTH_URL })
        )
    })
})
