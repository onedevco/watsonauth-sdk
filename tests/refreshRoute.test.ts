import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createRefreshPOST } from '../src/refreshRoute'
import { jsonResponse, makeJwtExpiringIn } from './helpers'

const handler = createRefreshPOST()

function requestWithCookies(cookies: Record<string, string>): NextRequest {
    const req = new NextRequest('https://app.test/api/auth/refresh', {
        method: 'POST',
    })
    for (const [name, value] of Object.entries(cookies)) {
        req.cookies.set(name, value)
    }
    return req
}

describe('createRefreshPOST', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('returns 401 token_missing when no refresh token cookie', async () => {
        const res = await handler(requestWithCookies({}))
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({
            code: 'token_missing',
            message: 'No refresh token',
        })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('forwards the refresh token cookie to Watson Auth and rotates cookies on success', async () => {
        const newAccess = makeJwtExpiringIn(900)
        fetchMock.mockResolvedValue(
            jsonResponse({
                accessToken: newAccess,
                refreshToken: 'new-refresh',
                expiresIn: 900,
            })
        )

        const res = await handler(
            requestWithCookies({ watson_refresh_token: 'old-refresh' })
        )

        expect(fetchMock).toHaveBeenCalledWith(
            `${process.env.WATSON_AUTH_URL}/api/auth/refresh`,
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Cookie: 'watson_refresh_token=old-refresh',
                }),
            })
        )

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ expiresIn: 900 })

        const access = res.cookies.get('access_token')
        expect(access?.value).toBe(newAccess)
        expect(access?.path).toBe('/')
        expect(access?.maxAge).toBe(900)

        const refresh = res.cookies.get('watson_refresh_token')
        expect(refresh?.value).toBe('new-refresh')
        expect(refresh?.path).toBe('/api/auth')
        expect(refresh?.maxAge).toBe(60 * 60 * 24 * 30)
    })

    it('returns 502 server_error when the upstream fetch throws', async () => {
        fetchMock.mockRejectedValue(new Error('connection refused'))
        const res = await handler(
            requestWithCookies({ watson_refresh_token: 'rt' })
        )
        expect(res.status).toBe(502)
        expect(await res.json()).toEqual({
            code: 'server_error',
            message: 'Failed to reach auth service',
        })
    })

    it('propagates non-ok status and clears cookies on 401', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(
                { code: 'token_invalid', message: 'Bad refresh' },
                { status: 401 }
            )
        )

        const res = await handler(
            requestWithCookies({ watson_refresh_token: 'rt' })
        )
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({
            code: 'token_invalid',
            message: 'Bad refresh',
        })

        const access = res.cookies.get('access_token')
        expect(access?.value).toBe('')
        expect(access?.maxAge).toBe(0)

        const refresh = res.cookies.get('watson_refresh_token')
        expect(refresh?.value).toBe('')
        expect(refresh?.maxAge).toBe(0)
    })

    it('propagates non-ok status without clearing cookies on 5xx', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({ code: 'server_error' }, { status: 500 })
        )
        const res = await handler(
            requestWithCookies({ watson_refresh_token: 'rt' })
        )
        expect(res.status).toBe(500)
        expect(res.cookies.get('access_token')).toBeUndefined()
        expect(res.cookies.get('watson_refresh_token')).toBeUndefined()
    })
})
