import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useWatsonUser } from '../src/useWatsonUser'
import { jsonResponse } from './helpers'

describe('useWatsonUser', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('fetches the user on mount and returns it', async () => {
        const user = {
            id: 'u1',
            email: 'a@b.com',
            name: 'A',
            emailVerified: true,
        }
        fetchMock.mockResolvedValue(jsonResponse({ user }))

        const { result } = renderHook(() => useWatsonUser())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.user).toEqual(user)
        expect(result.current.error).toBeNull()
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/me',
            expect.objectContaining({ credentials: 'include' })
        )
    })

    it('honors the custom endpoint option', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ user: null }))
        renderHook(() => useWatsonUser({ endpoint: '/api/whoami' }))
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled()
        })
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/whoami',
            expect.objectContaining({ credentials: 'include' })
        )
    })

    it('sets user=null when the endpoint returns non-ok', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({ user: null }, { status: 401 })
        )
        const { result } = renderHook(() => useWatsonUser())
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })
        expect(result.current.user).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('captures network errors on the error slot', async () => {
        fetchMock.mockRejectedValue(new Error('offline'))
        const { result } = renderHook(() => useWatsonUser())
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })
        expect(result.current.user).toBeNull()
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.error?.message).toBe('offline')
    })

    it('skips the initial fetch when auto is false and fetches on manual refresh', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({
                user: {
                    id: 'u1',
                    email: 'a@b.com',
                    name: null,
                    emailVerified: false,
                },
            })
        )

        const { result } = renderHook(() => useWatsonUser({ auto: false }))

        // small tick to let any auto-fetch run
        await new Promise((r) => setTimeout(r, 0))
        expect(fetchMock).not.toHaveBeenCalled()
        expect(result.current.user).toBeNull()

        await act(async () => {
            await result.current.refresh()
        })
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(result.current.user?.email).toBe('a@b.com')
    })

    it('refresh() clears a previous error', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'))
        const { result } = renderHook(() => useWatsonUser())
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBeInstanceOf(Error)

        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                user: {
                    id: 'u1',
                    email: 'a@b.com',
                    name: null,
                    emailVerified: true,
                },
            })
        )

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.error).toBeNull()
        expect(result.current.user?.email).toBe('a@b.com')
    })
})
