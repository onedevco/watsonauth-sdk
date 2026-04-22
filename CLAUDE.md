# Watson Auth SDK

## Overview

`@watsonauth/sdk` integrates Next.js applications with Watson Auth. It provides:

- **Server-side middleware** that verifies tokens and handles automatic refresh on every request (primary pattern)
- **`WatsonAuth` client class** for direct login flows (SPAs with their own login form)
- **React hooks** for reading user state in components

---

## Package Exports

| Import | Contents |
|--------|----------|
| `@watsonauth/sdk` | `WatsonAuth` class, `AuthError`, types |
| `@watsonauth/sdk/react` | `useWatsonUser`, `UserProfileDropdown` |
| `@watsonauth/sdk/next` | `createCallbackGET`, `createLogoutPOST`, `createRefreshPOST` |
| `@watsonauth/sdk/server` | `createWatsonAuthProxy`, `createUserGET` |
| `@watsonauth/sdk/Logout` | `UserProfileDropdown` (direct import) |
| `@watsonauth/sdk/userRoute` | `createUserGET` (direct import) |

---

## Next.js Setup (OAuth redirect flow)

This is the primary integration pattern. Watson Auth handles the login UI; the app receives tokens via a callback redirect.

### Environment variables

```bash
WATSON_AUTH_URL=https://watsonauth.com
WATSON_AUTH_APP_SLUG=your-app-slug
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

### 1. Middleware

Intercepts every request, verifies the access token, and proactively refreshes it 60 seconds before expiry. On any 401 from the refresh endpoint it redirects to login.

```typescript
// middleware.ts
import { createWatsonAuthProxy } from '@watsonauth/sdk/server'

export default createWatsonAuthProxy({
  initPublicPaths: ['/about', '/pricing'],
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 2. Callback route

Watson Auth redirects here after login with `?token=&refreshToken=&redirect=`. Stores `access_token` and `watson_refresh_token` as httpOnly cookies.

```typescript
// app/callback/route.ts
import { createCallbackGET } from '@watsonauth/sdk/next'
export const GET = createCallbackGET()
```

### 3. Logout route

Clears auth cookies.

```typescript
// app/api/auth/logout/route.ts
import { createLogoutPOST } from '@watsonauth/sdk/next'
export const POST = createLogoutPOST()
```

### 4. User route (optional)

Required only if using the `useWatsonUser` hook.

```typescript
// app/api/me/route.ts
import { createUserGET } from '@watsonauth/sdk/server'
export const GET = createUserGET()
```

---

## Token Refresh Architecture

Refresh is entirely server-side — the browser is never involved.

**Flow:**
1. Middleware decodes the `access_token` JWT and checks `exp`
2. If within 60 seconds of expiry, it calls `POST /api/auth/refresh` on Watson Auth server-to-server, forwarding `watson_refresh_token`
3. Watson Auth returns `{ accessToken, refreshToken, expiresIn }`
4. Middleware writes the new `access_token` + rotated `watson_refresh_token` cookies onto the response and continues the request
5. Any 401 from the refresh endpoint → redirect to login

**Cookies:**

| Cookie | httpOnly | Path | Lifetime |
|--------|----------|------|----------|
| `access_token` | yes | `/` | token `exp` |
| `watson_refresh_token` | yes | `/` | 30 days |

**Mutex:** A module-level promise prevents concurrent refresh calls within the same Node.js process. This has no effect in Edge runtime (stateless). For Edge, use an external lock (e.g. Upstash Redis).

### Optional refresh route handler

An alternative entry point if you need to trigger refresh from a route rather than middleware:

```typescript
// app/api/auth/refresh/route.ts
import { createRefreshPOST } from '@watsonauth/sdk/next'
export const POST = createRefreshPOST()
```

### Watson Auth service contract

`POST /api/auth/refresh` must accept a `watson_refresh_token` cookie and return:

```json
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```

Any `401` response clears all auth cookies and the user is redirected to login.

---

## React Hook

```typescript
import { useWatsonUser } from '@watsonauth/sdk/react'

function Component() {
  const { user, isLoading, error, refresh } = useWatsonUser()

  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>Not logged in</div>
  return <div>Hello, {user.name}</div>
}
```

Options:

```typescript
useWatsonUser({
  endpoint: '/api/me', // default
  auto: true,          // fetch on mount, default true
})
```

Returns `{ user: WatsonUser | null, isLoading: boolean, error: Error | null, refresh: () => Promise<void> }`.

---

## WatsonAuth Client (direct login flow)

For SPAs or non-Next.js apps with their own login form. Manages tokens client-side with automatic refresh.

```typescript
import { WatsonAuth } from '@watsonauth/sdk'

const auth = new WatsonAuth({
  baseUrl: 'https://watsonauth.com',
  appSlug: 'my-app',
  storage: 'localStorage',        // 'memory' (default) | 'localStorage' | 'sessionStorage' | adapter
  refreshThreshold: 60,           // seconds before expiry to refresh (default: 60)
  onAuthStateChange: (user) => {  // fires on login, logout, and session expiry
    if (!user) window.location.href = '/login'
  },
})
```

The constructor restores any stored token on init and schedules the refresh timer automatically.

### Methods

```typescript
// Login
const { user, accessToken } = await auth.login(email, password)

// Register
const { message } = await auth.register(email, password, name?)

// Logout — cancels timer, clears storage, calls server endpoint
await auth.logout()

// Get a valid token (refreshes if near expiry, deduplicates concurrent calls)
const token = await auth.getAccessToken()

// Sync accessors
const user = auth.getUser()           // User | null, decoded from token
const isAuth = auth.isAuthenticated() // boolean

// Subscribe to auth state changes — returns unsubscribe fn
const unsubscribe = auth.onAuthStateChange((user) => { ... })

// Other auth methods
await auth.forgotPassword(email)
await auth.resetPassword(token, newPassword)
await auth.verifyEmail(token)

// Redirect flow helpers
auth.redirectToLogin({ redirectUri: 'https://myapp.com/callback', state?: '...' })
const result = await auth.handleCallback()
```

### Storage adapter

```typescript
const auth = new WatsonAuth({
  baseUrl: '...',
  appSlug: '...',
  storage: {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    remove: (key) => AsyncStorage.removeItem(key),
  },
})
```

---

## Types

```typescript
interface User {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
}

interface WatsonAuthConfig {
  baseUrl: string
  appSlug: string
  autoRefresh?: boolean
  refreshThreshold?: number
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | StorageAdapter
  onAuthStateChange?: (user: User | null) => void
}

interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>
  set(key: string, value: string): void | Promise<void>
  remove(key: string): void | Promise<void>
}

// AuthError is thrown by all WatsonAuth client methods on failure
class AuthError extends Error {
  code: string      // e.g. 'invalid_credentials', 'validation_error'
  message: string
  details?: object  // field-level validation errors
}
```

---

## Endpoints Used

| Method | Endpoint | Used by |
|--------|----------|---------|
| POST | `/api/auth/login` | `WatsonAuth.login()` |
| POST | `/api/auth/register` | `WatsonAuth.register()` |
| POST | `/api/auth/logout` | `WatsonAuth.logout()`, `createLogoutPOST` |
| POST | `/api/auth/refresh` | `createWatsonAuthProxy` (server-to-server), `createRefreshPOST` |
| POST | `/api/auth/forgot-password` | `WatsonAuth.forgotPassword()` |
| POST | `/api/auth/reset-password` | `WatsonAuth.resetPassword()` |
| POST | `/api/auth/verify-email` | `WatsonAuth.verifyEmail()` |
| GET | `/.well-known/jwks.json` | `createWatsonAuthProxy` (JWT verification) |
