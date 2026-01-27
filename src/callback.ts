import { NextRequest, NextResponse } from 'next/server'

export function createCallbackGET() {
    return async (request: NextRequest) => {
        const accessToken = request.nextUrl.searchParams.get('token')
        const redirectTo = request.nextUrl.searchParams.get('redirect') || '/'

        if (!accessToken) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        const response = NextResponse.redirect(new URL(redirectTo, request.url))

        // Store access token in httpOnly cookie
        response.cookies.set('access_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 15, // 15 minutes (match token expiry)
            path: '/'
        })

        return response
    }
}
