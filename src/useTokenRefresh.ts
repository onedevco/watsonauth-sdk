import { useEffect, useRef } from 'react'

type UseTokenRefreshOptions = {
    endpoint?: string
    threshold?: number
    onSessionExpired?: () => void
}

const SESSION_EXPIRY_CODES = new Set([
    'token_missing',
    'token_invalid',
    'token_reused',
    'session_revoked',
    'token_expired',
    'account_disabled',
])

function getExpiresAt(): number | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(/(?:^|;\s*)expires_at=([^;]+)/)
    return match ? Number(match[1]) : null
}

export function useTokenRefresh(options: UseTokenRefreshOptions = {}) {
    const { endpoint = '/api/auth/refresh', threshold = 60, onSessionExpired } = options

    // Use refs for everything so the effect and timer callbacks always see
    // the latest values without needing to re-register
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const refreshPromiseRef = useRef<Promise<void> | null>(null)
    const onExpiredRef = useRef(onSessionExpired)
    const thresholdRef = useRef(threshold)
    const endpointRef = useRef(endpoint)

    useEffect(() => { onExpiredRef.current = onSessionExpired }, [onSessionExpired])
    useEffect(() => { thresholdRef.current = threshold }, [threshold])
    useEffect(() => { endpointRef.current = endpoint }, [endpoint])

    // schedule and doRefresh are defined on refs so they can call each other
    // without circular useCallback dependency chains
    const scheduleRef = useRef<(expiresAt: number) => void>()
    const doRefreshRef = useRef<(attempt?: number) => Promise<void>>()

    scheduleRef.current = (expiresAt: number) => {
        if (timerRef.current !== null) clearTimeout(timerRef.current)
        const now = Date.now() / 1000
        const delay = Math.max(0, (expiresAt - thresholdRef.current - now) * 1000)
        timerRef.current = setTimeout(() => {
            // Deduplicate: if a refresh is already running, do nothing
            if (!refreshPromiseRef.current) {
                refreshPromiseRef.current = doRefreshRef.current!().finally(() => {
                    refreshPromiseRef.current = null
                })
            }
        }, delay)
    }

    doRefreshRef.current = async (attempt = 0) => {
        let res: Response
        try {
            res = await fetch(endpointRef.current, {
                method: 'POST',
                credentials: 'include',
            })
        } catch {
            // Network error — reschedule from the existing cookie, don't log out
            const expiresAt = getExpiresAt()
            if (expiresAt) scheduleRef.current!(expiresAt)
            return
        }

        if (res.ok) {
            const data = await res.json() as { expiresIn: number }
            const newExpiresAt = Math.floor(Date.now() / 1000) + data.expiresIn
            scheduleRef.current!(newExpiresAt)
            return
        }

        const body = await res.json().catch(() => ({})) as { code?: string }

        if (body.code && SESSION_EXPIRY_CODES.has(body.code)) {
            onExpiredRef.current?.()
            return
        }

        if (body.code === 'server_error' && attempt < 3) {
            const backoff = Math.min(1000 * 2 ** attempt, 30_000)
            await new Promise<void>((resolve) => setTimeout(resolve, backoff))
            return doRefreshRef.current!(attempt + 1)
        }

        // Unknown error — reschedule from cookie to try again at the normal time
        const expiresAt = getExpiresAt()
        if (expiresAt) scheduleRef.current!(expiresAt)
    }

    useEffect(() => {
        const expiresAt = getExpiresAt()
        if (expiresAt) scheduleRef.current!(expiresAt)

        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current)
        }
    }, []) // intentionally empty — schedule once on mount, self-reschedules after each refresh
}
