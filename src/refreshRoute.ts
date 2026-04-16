import { NextRequest, NextResponse } from 'next/server'

const SESSION_EXPIRY_CODES = new Set([
    'token_missing',
    'token_invalid',
    'token_reused',
    'session_revoked',
    'token_expired',
    'account_disabled',
])

export function createRefreshPOST() {
    return async (request: NextRequest) => {
        const refreshToken = request.cookies.get('refresh_token')?.value

        if (!refreshToken) {
            return NextResponse.json(
                { code: 'token_missing', message: 'No refresh token' },
                { status: 401 }
            )
        }

        let res: Response
        try {
            res = await fetch(`${process.env.WATSON_AUTH_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    // Forward the refresh token as a cookie so Watson Auth
                    // receives it on the expected path
                    Cookie: `refresh_token=${refreshToken}`,
                },
            })
        } catch {
            return NextResponse.json(
                { code: 'server_error', message: 'Failed to reach auth service' },
                { status: 502 }
            )
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { code?: string; message?: string }
            const response = NextResponse.json(body, { status: res.status })

            // Clear all auth cookies on terminal session errors
            if (body.code && SESSION_EXPIRY_CODES.has(body.code)) {
                clearAuthCookies(response)
            }

            return response
        }

        const data = await res.json() as { accessToken: string; expiresIn: number }
        const isProduction = process.env.NODE_ENV === 'production'
        const expiresAt = Math.floor(Date.now() / 1000) + data.expiresIn

        const response = NextResponse.json({ expiresIn: data.expiresIn })

        response.cookies.set('access_token', data.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: data.expiresIn,
            path: '/',
        })

        response.cookies.set('expires_at', String(expiresAt), {
            httpOnly: false,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: data.expiresIn,
            path: '/',
        })

        return response
    }
}

function clearAuthCookies(response: NextResponse) {
    response.cookies.set('access_token', '', { maxAge: 0, path: '/' })
    response.cookies.set('refresh_token', '', { maxAge: 0, path: '/api/auth' })
    response.cookies.set('expires_at', '', { maxAge: 0, path: '/' })
}
