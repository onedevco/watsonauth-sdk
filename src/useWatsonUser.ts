import { useEffect, useMemo, useState } from 'react'

type WatsonUser = {
    id: string
    email: string
    name: string | null
    emailVerified: boolean
}

type UseWatsonUserOptions = {
    endpoint?: string
    auto?: boolean
}

type UseWatsonUserResult = {
    user: WatsonUser | null
    isLoading: boolean
    error: Error | null
    refresh: () => Promise<void>
}

export function useWatsonUser(options: UseWatsonUserOptions = {}): UseWatsonUserResult {
    const { endpoint = '/api/me', auto = true } = options
    const [user, setUser] = useState<WatsonUser | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const refresh = useMemo(() => {
        return async () => {
            setIsLoading(true)
            setError(null)

            try {
                const response = await fetch(endpoint, {
                    credentials: 'include'
                })

                if (!response.ok) {
                    setUser(null)
                    return
                }

                const data = (await response.json()) as { user: WatsonUser | null }
                setUser(data.user ?? null)
            } catch (err) {
                setUser(null)
                setError(err instanceof Error ? err : new Error('Failed to load user'))
            } finally {
                setIsLoading(false)
            }
        }
    }, [endpoint])

    useEffect(() => {
        if (!auto) return
        void refresh()
    }, [auto, refresh])

    return { user, isLoading, error, refresh }
}
