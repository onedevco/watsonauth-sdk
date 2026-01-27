# WatsonAuth

A Next.js authentication library for integrating with Watson Auth.

## Environment Variables

Add these to your `.env.local`:

```env
WATSON_AUTH_URL=https://your-watson-auth-server.com
WATSON_AUTH_APP_SLUG=your-app-slug
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Setup

### 1. Proxy

Create `proxy.ts` in your project root:

```typescript
import type { NextRequest } from 'next/server'
import { createWatsonAuthProxy } from '@/lib/watsonauth/proxy'

export async function proxy(request: NextRequest) {
    const watsonAuthProxy = createWatsonAuthProxy({
        // initPublicPaths: PUBLIC_PATHS
    })

    return watsonAuthProxy(request)
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

The proxy automatically:
- Allows `/login`, `/callback`, and `/api/public/*` paths
- Redirects unauthenticated users to Watson Auth login
- Validates JWT tokens using JWKS from the auth server

### 2. Callback Route

Create `app/callback/route.ts`:

```typescript
import { createCallbackGET } from '@/lib/watsonauth/callback'

export const GET = createCallbackGET()
```

This handles the OAuth callback, storing the access token in an httpOnly cookie.

### 3. Logout API Route

Create `app/api/logout/route.ts`:

```typescript
import { createLogoutPOST } from '@/lib/watsonauth/logoutRoute'

export const POST = await createLogoutPOST()
```

This clears the access token cookie on logout.

### 4. User Info API Route

Create `app/api/me/route.ts`:

```typescript
import { createUserGET } from '@/lib/watsonauth/userRoute'

export const GET = createUserGET()
```

Client usage:

```typescript
const res = await fetch('/api/me')
const { user } = await res.json()
// user.name -> string | null
```

This returns the user from the access token stored in the httpOnly cookie.

### 5. Client Hook (React)

```typescript
import { useWatsonUser } from '@watsonauth/sdk/react'

function Header() {
  const { user, isLoading } = useWatsonUser()

  if (isLoading) return <div>Loading...</div>

  return <div>Welcome {user?.name}</div>
}
```

### 6. Logout UI Component

Add the `UserProfileDropdown` component to your header or layout:

```typescript
import { UserProfileDropdown } from '@/lib/watsonauth/Logout'

export function Header() {
  return (
    <header>
      {/* ... other header content ... */}
      <UserProfileDropdown userName="John Doe" />
    </header>
  )
}
```

The component provides:
- User avatar with optional name display
- Dropdown menu with logout button
- Loading state during logout
- Automatic redirect after logout

## How It Works

1. **Unauthenticated Request**: Middleware redirects to Watson Auth login
2. **Login**: User authenticates on Watson Auth server
3. **Callback**: Watson Auth redirects back with token, stored in httpOnly cookie
4. **Authenticated Requests**: Middleware validates JWT on each request
5. **Logout**: Clears cookie and redirects to home (triggering re-auth)

## File Summary

| File | Purpose |
|------|---------|
| `proxy.ts` | Middleware for JWT validation and auth redirects |
| `callback.ts` | OAuth callback handler, stores token in cookie |
| `logoutRoute.ts` | API route to clear auth cookie |
| `Logout.tsx` | User profile dropdown with logout button |
