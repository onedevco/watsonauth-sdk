import { NextRequest, NextResponse } from 'next/server'

export function createRefreshPOST() {
    return async (request: NextRequest) => {
        const refreshToken = request.cookies.get('watson_refresh_token')?.value

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
                    Cookie: `watson_refresh_token=${refreshToken}`,
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
            // Any 401 means the session is dead — clear all auth cookies
            if (res.status === 401) clearAuthCookies(response)
            return response
        }

        const data = await res.json() as {
            accessToken: string
            refreshToken: string
            expiresIn: number
        }
        const isProduction = process.env.NODE_ENV === 'production'
        const response = NextResponse.json({ expiresIn: data.expiresIn })

        response.cookies.set('access_token', data.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: data.expiresIn,
            path: '/',
        })

        // Rotation: replace the old refresh token with the new one
        response.cookies.set('watson_refresh_token', data.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
        })

        return response
    }
}

function clearAuthCookies(response: NextResponse) {
    response.cookies.set('access_token', '', { maxAge: 0, path: '/' })
    response.cookies.set('watson_refresh_token', '', { maxAge: 0, path: '/' })
}
