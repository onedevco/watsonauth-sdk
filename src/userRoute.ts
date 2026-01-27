import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const JWKS = createRemoteJWKSet(new URL('/.well-known/jwks.json', process.env.WATSON_AUTH_URL!))

type WatsonUser = {
    id: string
    email: string
    name: string | null
    emailVerified: boolean
}

export function createUserGET() {
    return async (request: NextRequest) => {
        const token = request.cookies.get('access_token')?.value

        if (!token) {
            return NextResponse.json({ user: null }, { status: 401 })
        }

        try {
            const { payload } = await jwtVerify(token, JWKS, {
                issuer: process.env.WATSON_AUTH_URL
            })

            const user: WatsonUser = {
                id: typeof payload.sub === 'string' ? payload.sub : '',
                email: typeof payload.email === 'string' ? payload.email : '',
                name: typeof payload.name === 'string' ? payload.name : null,
                emailVerified: Boolean(payload.emailVerified)
            }

            return NextResponse.json({ user })
        } catch (error) {
            return NextResponse.json({ user: null }, { status: 401 })
        }
    }
}
