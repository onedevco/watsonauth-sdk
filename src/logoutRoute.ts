import { NextResponse } from 'next/server'

export function createLogoutPOST() {
    return async () => {
        const response = NextResponse.json({ success: true })

        // Clear the httpOnly cookie by setting it with maxAge: 0
        response.cookies.set('access_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/'
        })

        return response
    }
}
