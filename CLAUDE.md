# Watson Auth SDK Specification

## Overview

The `@watsonauth/sdk` package provides client-side utilities for applications integrating with Watson Auth. It handles token management, automatic refresh, and authentication state.

## Installation

```bash
npm install @watsonauth/sdk
```

## Core API

### `WatsonAuth` Client

```typescript
import { WatsonAuth } from '@watsonauth/sdk';

const auth = new WatsonAuth({
  baseUrl: 'https://watsonauth.com', // Watson Auth service URL
  appSlug: 'my-app',                   // Your registered app slug
});
```

### Configuration Options

```typescript
interface WatsonAuthConfig {
  baseUrl: string;              // Required: Watson Auth service URL
  appSlug: string;              // Required: App slug registered in Watson Auth
  autoRefresh?: boolean;        // Default: true - automatically refresh tokens
  refreshThreshold?: number;    // Default: 60 - seconds before expiry to refresh
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | StorageAdapter;
  onAuthStateChange?: (user: User | null) => void;
}
```

---

## Authentication Methods

### `login(email, password)`

```typescript
const result = await auth.login(email, password);
// Returns: { user: User, accessToken: string } | throws AuthError
```

### `register(email, password, name?)`

```typescript
const result = await auth.register(email, password, name);
// Returns: { user: User, message: string } | throws AuthError
```

### `logout()`

```typescript
await auth.logout();
// Clears local state and calls server logout endpoint
```

### `forgotPassword(email)`

```typescript
await auth.forgotPassword(email);
// Returns: { message: string } - always succeeds to prevent enumeration
```

### `resetPassword(token, newPassword)`

```typescript
await auth.resetPassword(token, newPassword);
// Returns: { message: string } | throws AuthError
```

### `verifyEmail(token)`

```typescript
await auth.verifyEmail(token);
// Returns: { message: string } | throws AuthError
```

---

## Token Management

### `getAccessToken()`

```typescript
const token = await auth.getAccessToken();
// Returns valid access token, refreshing if needed
// Returns null if not authenticated
```

### `getUser()`

```typescript
const user = auth.getUser();
// Returns current user from decoded token, or null
```

### `isAuthenticated()`

```typescript
const isAuth = auth.isAuthenticated();
// Returns boolean
```

### `onAuthStateChange(callback)`

```typescript
const unsubscribe = auth.onAuthStateChange((user) => {
  if (user) {
    console.log('Logged in:', user.email);
  } else {
    console.log('Logged out');
  }
});

// Later: unsubscribe();
```

---

## Types

```typescript
interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

interface AuthError {
  code: string;        // e.g., 'invalid_credentials', 'validation_error'
  message: string;     // Human-readable message
  details?: object;    // Validation errors if applicable
}

interface TokenPayload {
  sub: string;         // User ID
  email: string;
  name: string | null;
  emailVerified: boolean;
  appId: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}
```

---

## Framework Integrations

### React Hook

```typescript
import { useWatsonAuth } from '@watsonauth/sdk/react';

function Component() {
  const { user, isLoading, isAuthenticated, login, logout } = useWatsonAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <button onClick={() => login(email, password)}>Login</button>;
  }

  return <div>Hello, {user.name}</div>;
}
```

### React Provider

```typescript
import { WatsonAuthProvider } from '@watsonauth/sdk/react';

function App() {
  return (
    <WatsonAuthProvider
      baseUrl="https://watsonauth.com"
      appSlug="my-app"
    >
      <MyApp />
    </WatsonAuthProvider>
  );
}
```

### Next.js Middleware Helper

```typescript
import { withAuth } from '@watsonauth/sdk/next';

export default withAuth({
  jwksUrl: 'https://auth.example.com/.well-known/jwks.json',
  publicPaths: ['/login', '/register', '/public'],
});
```

---

## Server-Side Token Verification

For API routes that need to verify tokens:

```typescript
import { verifyToken } from '@watsonauth/sdk/server';

const payload = await verifyToken(accessToken, {
  jwksUrl: 'https://auth.example.com/.well-known/jwks.json',
  issuer: 'https://auth.example.com',
  audience: 'my-app', // optional
});
```

---

## Error Handling

All methods throw `AuthError` on failure:

```typescript
try {
  await auth.login(email, password);
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'invalid_credentials':
        // Wrong email/password
        break;
      case 'account_disabled':
        // Account is disabled
        break;
      case 'no_app_access':
        // User doesn't have access to this app
        break;
      case 'validation_error':
        // Check error.details for field errors
        break;
    }
  }
}
```

---

## Storage Adapters

Custom storage for tokens:

```typescript
interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

// Example: React Native AsyncStorage
const auth = new WatsonAuth({
  baseUrl: 'https://auth.example.com',
  appSlug: 'my-app',
  storage: {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    remove: (key) => AsyncStorage.removeItem(key),
  },
});
```

---

## Redirect Flow (for hosted pages)

```typescript
// Redirect to hosted login
auth.redirectToLogin({
  redirectUri: 'https://myapp.com/callback',
  state: 'optional-state-param',
});

// Handle callback (extracts tokens from URL/cookies)
const result = await auth.handleCallback();
```

---

## Package Exports

```
@watsonauth/sdk           # Core client
@watsonauth/sdk/react     # React hooks and provider
@watsonauth/sdk/next      # Next.js middleware
@watsonauth/sdk/server    # Server-side token verification
```

---

## Endpoints Used

The SDK interacts with these Watson Auth endpoints:

| Method | Endpoint | SDK Method |
|--------|----------|------------|
| POST | `/api/auth/login` | `login()` |
| POST | `/api/auth/register` | `register()` |
| POST | `/api/auth/logout` | `logout()` |
| POST | `/api/auth/refresh` | `getAccessToken()` (internal) |
| POST | `/api/auth/forgot-password` | `forgotPassword()` |
| POST | `/api/auth/reset-password` | `resetPassword()` |
| POST | `/api/auth/verify-email` | `verifyEmail()` |
| GET | `/.well-known/jwks.json` | `verifyToken()` (server) |
