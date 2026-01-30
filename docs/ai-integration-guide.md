# WatsonAuth AI Integration Guide

This guide is written for AI systems that need to implement authentication in an app
using `@watsonauth/sdk` and `watsonauth.com` as the auth provider. It focuses on the
hosted login flow (recommended) and includes a fallback option for custom login forms.

Use this document as the single source of truth for how to wire Watson Auth into a
Next.js app or any React-based frontend with API routes.

---

## Quick Decision

- Prefer **hosted login** for fastest integration and least maintenance.
- Use **custom forms** only when you must own the UI/UX.

---

## Required Inputs

You must obtain these values from Watson Auth:

- `WATSON_AUTH_URL` or `NEXT_PUBLIC_WATSON_AUTH_URL` (example: `https://watsonauth.com`)
- `WATSON_AUTH_APP_SLUG` or `NEXT_PUBLIC_WATSON_AUTH_APP_SLUG` (your app slug)

Optional:

- `NEXT_PUBLIC_APP_URL` for callbacks and redirects (e.g. `http://localhost:3000`)

---

## Hosted Login Flow (Recommended)

### 1. Install SDK

```bash
npm install @watsonauth/sdk
```

### 2. Add Environment Variables

```env
NEXT_PUBLIC_WATSON_AUTH_URL=https://watsonauth.com
NEXT_PUBLIC_WATSON_AUTH_APP_SLUG=my-app
```

### 3. Wrap App with Provider (React)

Create `AuthProvider` and wrap your app:

```tsx
'use client';

import { WatsonAuthProvider } from '@watsonauth/sdk/react';
import { ReactNode } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <WatsonAuthProvider
      baseUrl={process.env.NEXT_PUBLIC_WATSON_AUTH_URL!}
      appSlug={process.env.NEXT_PUBLIC_WATSON_AUTH_APP_SLUG!}
    >
      {children}
    </WatsonAuthProvider>
  );
}
```

### 4. Redirect to Hosted Login

On your public landing page, call `redirectToLogin()`:

```tsx
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';

export default function Home() {
  const { redirectToLogin, isLoading, isAuthenticated } = useWatsonAuth();

  if (isLoading) return <div>Loading...</div>;
  if (isAuthenticated) return <div>Signed in</div>;

  return (
    <button
      onClick={() =>
        redirectToLogin({
          redirectUri: `${window.location.origin}/auth/callback`,
        })
      }
    >
      Sign In
    </button>
  );
}
```

### 5. Handle Callback

Create `/auth/callback` page that calls `handleCallback()`:

```tsx
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const { handleCallback } = useWatsonAuth();
  const router = useRouter();

  useEffect(() => {
    async function run() {
      await handleCallback();
      router.push('/dashboard');
    }
    run();
  }, [handleCallback, router]);

  return <div>Completing sign in...</div>;
}
```

### 6. Protect Routes

For Next.js middleware protection, use `withAuth`:

```ts
import { withAuth } from '@watsonauth/sdk/next';

export default withAuth({
  jwksUrl: `${process.env.NEXT_PUBLIC_WATSON_AUTH_URL}/.well-known/jwks.json`,
  publicPaths: ['/', '/auth/callback'],
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Custom Login Forms (Optional)

If you need full control over the UI, use `login()` and `register()` directly.

```tsx
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';
import { AuthError } from '@watsonauth/sdk';
import { useState } from 'react';

export default function LoginForm() {
  const { login } = useWatsonAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError('Login failed');
      }
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

---

## Server-Side Token Verification

For API routes or server-side checks, verify tokens with JWKS:

```ts
import { verifyToken } from '@watsonauth/sdk/server';

const payload = await verifyToken(accessToken, {
  jwksUrl: `${process.env.NEXT_PUBLIC_WATSON_AUTH_URL}/.well-known/jwks.json`,
  issuer: process.env.NEXT_PUBLIC_WATSON_AUTH_URL!,
  audience: 'my-app', // optional
});
```

---

## Behavior Summary (Auth Lifecycle)

1. User clicks "Sign In" -> app redirects to Watson Auth hosted login.
2. Watson Auth authenticates user and redirects back to `/auth/callback`.
3. `handleCallback()` stores tokens and updates auth state.
4. Protected routes are allowed once token is valid.
5. `logout()` clears local state and invalidates tokens server-side.

---

## References in This Repository

- `docs/nextjs-integration-example.md` for full Next.js examples
- `README.md` for proxy-based setup guidance
- `src/*` for core SDK implementation
