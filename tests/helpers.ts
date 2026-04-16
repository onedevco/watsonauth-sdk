/**
 * Base64url encode a string (browser-safe, uses btoa).
 */
function base64UrlEncode(input: string): string {
    return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build an unsigned JWT-shaped token (header.payload.signature).
 * The client decoder in this SDK does not verify the signature, so this is
 * sufficient for unit tests of client-side token decoding / expiry logic.
 */
export function makeJwt(payload: Record<string, unknown>): string {
    const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    const body = base64UrlEncode(JSON.stringify(payload))
    return `${header}.${body}.sig`
}

/**
 * Build a JWT whose `exp` is `secondsFromNow` seconds from the current time.
 */
export function makeJwtExpiringIn(
    secondsFromNow: number,
    extra: Record<string, unknown> = {}
): string {
    const nowSec = Math.floor(Date.now() / 1000)
    return makeJwt({
        sub: 'user_1',
        email: 'alice@example.com',
        name: 'Alice',
        emailVerified: true,
        exp: nowSec + secondsFromNow,
        ...extra,
    })
}

/** A tiny JSON `Response` factory. */
export function jsonResponse(
    body: unknown,
    init: { status?: number } = {}
): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
    })
}
