# Watson Auth SDK Integration with Next.js

This guide shows how to integrate `@watsonauth/sdk` with a Next.js app. It covers two approaches:

1. **Hosted Login (Recommended)** - Use Watson Auth's hosted login pages for minimal setup
2. **Custom Login Forms** - Build your own login UI if you need full control

Both approaches support linking Watson Auth users to your own user model.

---

## Quick Start: Hosted Login Flow

This is the simplest approach - Watson Auth handles the login/register UI for you.

### 1. Create a Fresh Next.js App

```bash
npx create-next-app@latest my-app --typescript --tailwind --app --src-dir
cd my-app
npm install @watsonauth/sdk
```

### 2. Project Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── auth/
│   │   └── callback/page.tsx    # Handles redirect from Watson Auth
│   ├── dashboard/page.tsx
│   └── api/
│       └── user/
│           ├── route.ts
│           └── sync/route.ts
├── components/
│   └── AuthProvider.tsx
├── lib/
│   ├── auth.ts
│   └── db.ts
└── types/
    └── user.ts
```

### 3. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_WATSON_AUTH_URL=https://watsonauth.com
NEXT_PUBLIC_WATSON_AUTH_APP_SLUG=my-app
DATABASE_URL=your-database-url
```

### 4. Auth Provider

**`src/components/AuthProvider.tsx`**

```typescript
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

### 5. Root Layout

**`src/app/layout.tsx`**

```typescript
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

### 6. Home Page with Login Button

**`src/app/page.tsx`**

```typescript
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { isAuthenticated, isLoading, redirectToLogin } = useWatsonAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  function handleLogin() {
    // Redirects to Watson Auth's hosted login page
    redirectToLogin({
      redirectUri: `${window.location.origin}/auth/callback`,
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Welcome to My App</h1>
        <p className="text-gray-600">Sign in to get started</p>
        <button
          onClick={handleLogin}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Sign In with Watson Auth
        </button>
      </div>
    </div>
  );
}
```

### 7. Auth Callback Handler

**`src/app/auth/callback/page.tsx`**

```typescript
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthCallbackPage() {
  const { handleCallback } = useWatsonAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        // Extract tokens from URL/cookies set by Watson Auth
        await handleCallback();

        // Sync user to local database
        await fetch('/api/user/sync', { method: 'POST' });

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (err) {
        setError('Authentication failed. Please try again.');
      }
    }

    processCallback();
  }, [handleCallback, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <a href="/" className="text-blue-600 hover:underline">
            Return home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Completing sign in...</p>
    </div>
  );
}
```

### 8. Protected Dashboard

**`src/app/dashboard/page.tsx`**

```typescript
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AppUser } from '@/types/user';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useWatsonAuth();
  const router = useRouter();
  const [appUser, setAppUser] = useState<AppUser | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/user')
        .then((res) => res.json())
        .then((data) => setAppUser(data.user))
        .catch(console.error);
    }
  }, [isAuthenticated]);

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Logout
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
          <div className="space-y-2">
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Name:</strong> {user?.name || 'Not set'}</p>
            <p>
              <strong>Email Verified:</strong>{' '}
              {user?.emailVerified ? 'Yes' : 'No'}
            </p>

            {appUser && (
              <>
                <hr className="my-4" />
                <h3 className="font-semibold">App-Specific Data</h3>
                <p><strong>Subscription:</strong> {appUser.subscription}</p>
                <p>
                  <strong>Member since:</strong>{' '}
                  {new Date(appUser.createdAt).toLocaleDateString()}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 9. Local User Model (Optional)

If you need app-specific user data, link Watson Auth users to your own model.

**`src/types/user.ts`**

```typescript
export interface AppUser {
  id: string;
  watsonAuthId: string;  // Links to Watson Auth user
  email: string;
  name: string | null;
  avatarUrl: string | null;
  subscription: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}
```

**`prisma/schema.prisma`**

```prisma
model User {
  id            String   @id @default(cuid())
  watsonAuthId  String   @unique
  email         String   @unique
  name          String?
  avatarUrl     String?
  subscription  String   @default("free")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**`src/lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function findOrCreateUser(watsonUser: {
  id: string;
  email: string;
  name: string | null;
}) {
  let user = await prisma.user.findUnique({
    where: { watsonAuthId: watsonUser.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        watsonAuthId: watsonUser.id,
        email: watsonUser.email,
        name: watsonUser.name,
        subscription: 'free',
      },
    });
  } else if (user.email !== watsonUser.email || user.name !== watsonUser.name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email: watsonUser.email, name: watsonUser.name },
    });
  }

  return user;
}
```

### 10. API Routes

**`src/app/api/user/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@watsonauth/sdk/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await verifyToken(token, {
      jwksUrl: `${process.env.NEXT_PUBLIC_WATSON_AUTH_URL}/.well-known/jwks.json`,
      issuer: process.env.NEXT_PUBLIC_WATSON_AUTH_URL!,
    });

    const user = await prisma.user.findUnique({
      where: { watsonAuthId: payload.sub },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

**`src/app/api/user/sync/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@watsonauth/sdk/server';
import { findOrCreateUser } from '@/lib/db';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await verifyToken(token, {
      jwksUrl: `${process.env.NEXT_PUBLIC_WATSON_AUTH_URL}/.well-known/jwks.json`,
      issuer: process.env.NEXT_PUBLIC_WATSON_AUTH_URL!,
    });

    const user = await findOrCreateUser({
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

### 11. Middleware (Protect Routes)

**`src/middleware.ts`**

```typescript
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

## How the Hosted Flow Works

1. User clicks "Sign In" → `redirectToLogin()` sends them to Watson Auth
2. User logs in/registers on Watson Auth's hosted pages
3. Watson Auth redirects back to `/auth/callback` with tokens
4. `handleCallback()` extracts and stores the tokens
5. Your app syncs the user to your local database
6. User is redirected to the dashboard

This approach means:
- No login/register forms to build or maintain
- Watson Auth handles password reset, email verification, etc.
- Your app just handles the callback and user sync

---

## Alternative: Custom Login Forms

If you need full control over the login UI, you can use the SDK's `login()` and `register()` methods directly. See the sections below for complete form implementations.

### Custom Login Page

**`src/app/login/page.tsx`**

```typescript
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';
import { AuthError } from '@watsonauth/sdk';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useWatsonAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      await fetch('/api/user/sync', { method: 'POST' });
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof AuthError) {
        switch (err.code) {
          case 'invalid_credentials':
            setError('Invalid email or password');
            break;
          case 'account_disabled':
            setError('Your account has been disabled');
            break;
          case 'no_app_access':
            setError('You do not have access to this application');
            break;
          default:
            setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center">Sign In</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### Custom Register Page

**`src/app/register/page.tsx`**

```typescript
'use client';

import { useWatsonAuth } from '@watsonauth/sdk/react';
import { AuthError } from '@watsonauth/sdk';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const { register } = useWatsonAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register(email, password, name);
      router.push('/login?registered=true');
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.code === 'validation_error' && err.details) {
          const messages = Object.values(err.details).flat().join(', ');
          setError(messages);
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center">Create Account</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

## Fetch Wrapper for API Calls

**`src/lib/api.ts`**

```typescript
import { getAuth } from './auth';

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const auth = getAuth();
  const token = await auth.getAccessToken();

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
```

**`src/lib/auth.ts`**

```typescript
import { WatsonAuth } from '@watsonauth/sdk';

let authInstance: WatsonAuth | null = null;

export function getAuth(): WatsonAuth {
  if (!authInstance) {
    authInstance = new WatsonAuth({
      baseUrl: process.env.NEXT_PUBLIC_WATSON_AUTH_URL!,
      appSlug: process.env.NEXT_PUBLIC_WATSON_AUTH_APP_SLUG!,
      autoRefresh: true,
      refreshThreshold: 60,
      storage: 'localStorage',
    });
  }
  return authInstance;
}
```

---

## Summary

| Approach | Pros | Cons |
|----------|------|------|
| **Hosted Login** | Minimal code, Watson Auth handles UI, password reset, etc. | Less control over branding |
| **Custom Forms** | Full control over UI/UX | More code to maintain |

For most apps, the hosted login flow is recommended. Use custom forms only if you have specific branding or UX requirements.
