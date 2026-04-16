import { NextRequest, NextResponse } from 'next/server'
import { decodeJwt } from 'jose'

export function createCallbackGET() {
    return async (request: NextRequest) => {
        const accessToken = request.nextUrl.searchParams.get('token')
        const refreshToken = request.nextUrl.searchParams.get('refreshToken')
        const redirectTo = request.nextUrl.searchParams.get('redirect') || '/'

        if (!accessToken) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // Decode exp from the JWT itself rather than trusting a URL param
        let expiresIn = 900
        try {
            const payload = decodeJwt(accessToken)
            if (payload.exp) {
                expiresIn = Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
            }
        } catch {
            // fall back to default
        }

        const isProduction = process.env.NODE_ENV === 'production'
        const response = NextResponse.redirect(new URL(redirectTo, request.url))

        response.cookies.set('access_token', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: expiresIn,
            path: '/',
        })

        if (refreshToken) {
            response.cookies.set('watson_refresh_token', refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: '/api/auth',
            })
        }

        return response
    }
}
