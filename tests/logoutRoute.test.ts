import { describe, expect, it } from 'vitest'
import { createLogoutPOST } from '../src/logoutRoute'

const handler = createLogoutPOST()

describe('createLogoutPOST', () => {
    it('returns { success: true }', async () => {
        const res = await handler()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true })
    })

    it('expires the access_token cookie', async () => {
        const res = await handler()
        const cookie = res.cookies.get('access_token')
        expect(cookie).toBeDefined()
        expect(cookie?.value).toBe('')
        expect(cookie?.maxAge).toBe(0)
        expect(cookie?.path).toBe('/')
        expect(cookie?.httpOnly).toBe(true)
        expect(cookie?.sameSite).toBe('lax')
    })
})
