import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createCallbackGET } from '../src/callback'
import { makeJwt, makeJwtExpiringIn } from './helpers'

const handler = createCallbackGET()

function buildRequest(url: string): NextRequest {
    return new NextRequest(url)
}

describe('createCallbackGET', () => {
    it('redirects to /login when no token is provided', async () => {
        const req = buildRequest('https://app.test/callback')
        const res = await handler(req)
        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toBe('https://app.test/login')
    })

    it('sets access_token cookie and redirects to root by default', async () => {
        const token = makeJwtExpiringIn(900)
        const req = buildRequest(`https://app.test/callback?token=${token}`)
        const res = await handler(req)

        expect(res.status).toBe(307)
        expect(res.headers.get('location')).toBe('https://app.test/')

        const cookie = res.cookies.get('access_token')
        expect(cookie?.value).toBe(token)
        expect(cookie?.httpOnly).toBe(true)
        expect(cookie?.path).toBe('/')
        expect(cookie?.sameSite).toBe('lax')
    })

    it('honors the redirect query param', async () => {
        const token = makeJwtExpiringIn(900)
        const req = buildRequest(
            `https://app.test/callback?token=${token}&redirect=/dashboard`
        )
        const res = await handler(req)
        expect(res.headers.get('location')).toBe('https://app.test/dashboard')
    })

    it('stores refresh token with /api/auth path when provided', async () => {
        const token = makeJwtExpiringIn(900)
        const req = buildRequest(
            `https://app.test/callback?token=${token}&refreshToken=rt_123`
        )
        const res = await handler(req)

        const refresh = res.cookies.get('watson_refresh_token')
        expect(refresh?.value).toBe('rt_123')
        expect(refresh?.path).toBe('/api/auth')
        expect(refresh?.httpOnly).toBe(true)
        expect(refresh?.maxAge).toBe(60 * 60 * 24 * 30)
    })

    it('does not set a refresh cookie when the param is absent', async () => {
        const token = makeJwtExpiringIn(900)
        const req = buildRequest(`https://app.test/callback?token=${token}`)
        const res = await handler(req)
        expect(res.cookies.get('watson_refresh_token')).toBeUndefined()
    })

    it('derives cookie maxAge from the JWT exp claim', async () => {
        const token = makeJwtExpiringIn(600)
        const req = buildRequest(`https://app.test/callback?token=${token}`)
        const res = await handler(req)

        const cookie = res.cookies.get('access_token')
        // Allow a couple seconds of slop for test execution
        expect(cookie?.maxAge).toBeGreaterThan(595)
        expect(cookie?.maxAge).toBeLessThanOrEqual(600)
    })

    it('falls back to a 900s default when the token has no exp claim', async () => {
        const token = makeJwt({ sub: 'u1' }) // no exp
        const req = buildRequest(`https://app.test/callback?token=${token}`)
        const res = await handler(req)
        expect(res.cookies.get('access_token')?.maxAge).toBe(900)
    })
})
