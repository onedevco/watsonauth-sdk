import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const JWKS = createRemoteJWKSet(new URL('/.well-known/jwks.json', process.env.WATSON_AUTH_URL!))

export function createWatsonAuthProxy({ initPublicPaths = [] }: { initPublicPaths?: string[] }) {
    const publicPaths = ['/login', '/callback', ...initPublicPaths]
    return async (request: NextRequest) => {
        const { pathname } = request.nextUrl

        // Allow public paths
        if (publicPaths.some((p) => pathname === p || pathname.startsWith('/api/public'))) {
            return NextResponse.next()
        }

        // Get access token from cookie
        const token = request.cookies.get('access_token')?.value

        if (!token) {
            // Redirect to Watson Auth login
            const loginUrl = new URL('/login', process.env.WATSON_AUTH_URL)
            loginUrl.searchParams.set('app', process.env.WATSON_AUTH_APP_SLUG!)
            loginUrl.searchParams.set('callback', `${process.env.NEXT_PUBLIC_APP_URL}/callback`)
            console.log('redirecting to login', loginUrl.toString())
            return NextResponse.redirect(loginUrl)
        }

        try {
            const { payload } = await jwtVerify(token, JWKS, {
                issuer: process.env.WATSON_AUTH_URL
            })
            const requestHeaders = new Headers(request.headers)
            requestHeaders.set('x-user-id', payload.sub as string)
            return NextResponse.next({
                request: { headers: requestHeaders }
            })
        } catch (error) {
            // Token invalid/expired - redirect to login
            console.log('error', error)
            const loginUrl = new URL('/login', process.env.WATSON_AUTH_URL)
            loginUrl.searchParams.set('app', process.env.WATSON_AUTH_APP_SLUG!)
            loginUrl.searchParams.set('callback', `${process.env.NEXT_PUBLIC_APP_URL}/callback`)
            return NextResponse.redirect(loginUrl)
        }
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
