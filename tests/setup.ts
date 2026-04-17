import { beforeEach, vi } from 'vitest'

// Ensure required env vars exist for modules that read them at import time.
process.env.WATSON_AUTH_URL ??= 'https://watsonauth.test'
process.env.WATSON_AUTH_APP_SLUG ??= 'test-app'
process.env.NEXT_PUBLIC_APP_URL ??= 'https://app.test'

beforeEach(() => {
    vi.restoreAllMocks()
})
