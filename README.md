# sigma-auth-client-plugin

Better Auth client plugin for Bitcoin-based OAuth authentication with Sigma Identity.

## Purpose

This package provides a Better Auth client plugin that:
- Initiates OAuth redirect flow to auth.sigmaidentity.com
- Supports both traditional OAuth redirect and iframe signer patterns
- Works in both Next.js and React-only applications
- Provides TypeScript-safe authentication methods
- Handles OAuth callback and token exchange

## Architecture

### OAuth Redirect Flow

1. Client calls `authClient.signIn.sigma()` or `authClient.signIn.sigmaProvider({ provider: 'github' })`
2. Plugin redirects to `auth.sigmaidentity.com/api/oauth/authorize`
3. User authenticates with Bitcoin signature on auth domain
4. Auth server redirects back with authorization code
5. Client exchanges code for access token via backend API route
6. Client receives user session

### Integration Patterns

The plugin supports multiple integration patterns found across projects:

#### Pattern 1: Direct OAuth (sigma-auth-web, allaboard-bitchat-nitro)
Simple redirect to auth server for authentication.

#### Pattern 2: OAuth with Provider Support (sigma-auth-web)
Redirect with additional OAuth provider parameter (GitHub, Google, etc.)

#### Pattern 3: Iframe Signer (can integrate with sigma-auth-iframe-signer)
Use embedded iframe for signing without full page redirect.

## Source Implementations

Based on multiple implementations:

### sigma-auth-web
- **File**: `/Users/satchmo/code/sigma-auth-web/lib/sigma-client-plugin.ts`
- **Features**: OAuth providers, subscription endpoints
- **Lines**: ~100 lines

### allaboard-bitchat-nitro
- **File**: `/Users/satchmo/code/allaboard-bitchat-nitro/src/lib/sigma-client-plugin.ts`
- **Features**: Simple OAuth redirect
- **Lines**: ~50 lines

### droplit
- **File**: `/Users/satchmo/code/droplit/lib/sigma-client.ts`
- **Features**: Redirect-based signing (different pattern)
- **Lines**: ~120 lines

## Key Differences Found

### sigma-auth-web (Full-Featured)
```typescript
signIn: {
  sigma: async () => { /* OAuth redirect */ },
  sigmaProvider: async ({ provider }) => { /* OAuth with provider */ }
}

subscription: {
  status: async () => { /* Fetch subscription */ },
  update: async () => { /* Update subscription */ }
}
```

### bitchat-nitro (Minimal)
```typescript
signIn: {
  sigma: async () => { /* Simple OAuth redirect */ }
}
```

## Better Auth Compatibility

**Important Finding**: Better Auth works in React-only apps (not just Next.js)!

- ✅ Next.js (App Router, Pages Router)
- ✅ React + backend (Vite + Elysia in bitchat-nitro)
- ✅ SvelteKit, Nuxt, Solid Start
- ✅ Any frontend framework

## API Design Intentions

### Core Methods

```typescript
interface SigmaClientPlugin {
  id: 'sigma';

  getActions($fetch) {
    return {
      signIn: {
        // Simple OAuth redirect to auth.sigmaidentity.com
        sigma: async (options?: {
          callbackUrl?: string;
        }) => void;

        // OAuth with provider parameter (GitHub, Google, etc.)
        sigmaProvider: async (data: {
          provider: 'github' | 'google' | 'handcash';
          callbackUrl?: string;
        }) => void;
      };

      // Optional: Subscription management (can be separate package)
      subscription?: {
        status: async () => Promise<SubscriptionStatus>;
        update: async (data: UpdateSubscriptionData) => Promise<void>;
      };
    };
  };
}
```

### Configuration Options

```typescript
sigmaClient({
  // Base URL for auth server
  authServerUrl?: string; // default: https://auth.sigmaidentity.com

  // OAuth client ID (optional - uses pubkey signature for identification)
  clientId?: string;

  // Redirect URI after authentication
  redirectUri?: string;

  // Supported OAuth providers
  providers?: ('github' | 'google' | 'handcash')[];

  // Enable subscription features
  subscriptionFeatures?: boolean;
})
```

## Integration Examples

### Next.js App Router

**Step 1: Create auth client**
```typescript
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { sigmaClient } from '@sigma-auth/client-plugin';

export const authClient = createAuthClient({
  plugins: [sigmaClient()],
});

// Export hooks for React components
export const { useSession } = authClient;
```

**Step 2: Add sign-in button**
```typescript
// components/SignInButton.tsx
import { authClient } from '@/lib/auth-client';

export function SignInButton() {
  return (
    <button onClick={() => authClient.signIn.sigma()}>
      Sign in with Bitcoin
    </button>
  );
}

// With OAuth provider
<button onClick={() => authClient.signIn.sigma({ provider: 'github' })}>
  Sign in with GitHub
</button>
```

**Step 3: Create callback API route** (REQUIRED)
```typescript
// app/api/auth/callback/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from 'bitcoin-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { code, state } = await request.json();

  // Get platform member private key (server-side only)
  const memberPrivateKey = process.env.SIGMA_MEMBER_PRIVATE_KEY;
  if (!memberPrivateKey) {
    throw new Error('SIGMA_MEMBER_PRIVATE_KEY not configured');
  }

  // Sign token exchange request with platform member key
  const authToken = getAuthToken({
    privateKeyWif: memberPrivateKey,
    requestPath: '/api/oauth/token',
  });

  // Exchange authorization code for access token
  const authServerUrl = process.env.NEXT_PUBLIC_AUTH_SERVER_URL || 'https://auth.sigmaidentity.com';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const tokenResponse = await fetch(`${authServerUrl}/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Token': authToken,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${siteUrl}/callback`,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    return NextResponse.json(
      { error: 'Token exchange failed', details: errorData },
      { status: tokenResponse.status }
    );
  }

  const tokens = await tokenResponse.json();

  // Get user info with the access token
  const userInfoResponse = await fetch(`${authServerUrl}/api/oauth/userinfo`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: userInfoResponse.status }
    );
  }

  const userInfo = await userInfoResponse.json();

  return NextResponse.json({
    user: userInfo,
    session: {
      token: tokens.access_token,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
}
```

**Step 4: Create callback page** (REQUIRED)
```typescript
// app/callback/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Check for errors
      const errorParam = searchParams.get('error');
      if (errorParam) {
        setError(searchParams.get('error_description') || errorParam);
        return;
      }

      // Get authorization code and state
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code) {
        setError('Missing authorization code');
        return;
      }

      // Verify state for CSRF protection
      const savedState = sessionStorage.getItem('oauth_state');
      if (state !== savedState) {
        setError('Invalid state parameter - possible CSRF attack');
        return;
      }
      sessionStorage.removeItem('oauth_state');

      try {
        // Exchange code for token via backend API route
        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Token exchange failed');
          return;
        }

        const data = await response.json();

        // Store user session (implementation depends on your state management)
        // For example, with zustand store:
        // setAuthenticatedUser(data.user, data.session.token);

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <div>Authenticating...</div>;
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
```

### React + Backend (Vite + Elysia)

**Frontend** (`allaboard-bitchat-nitro` pattern):

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { sigmaClient } from '@sigma-auth/client-plugin';

export const authClient = createAuthClient({
  plugins: [sigmaClient()],
});

// Usage in components
import { authClient } from '@/lib/auth-client';

<button onClick={() => authClient.signIn.sigma()}>
  Sign in with Bitcoin
</button>
```

**Backend** (`nitro-api` pattern):

```typescript
// src/index.tsx (Elysia)
import { Elysia, t } from 'elysia';
import { getAuthToken } from 'bitcoin-auth';

const app = new Elysia();

// OAuth token exchange endpoint (REQUIRED)
app.post('/oauth/exchange', async ({ body, set }) => {
  const { code, redirectUri } = body;

  // Get platform member private key
  const memberWif = process.env.BITCHAT_MEMBER_WIF;
  if (!memberWif) {
    set.status = 500;
    return { error: 'Server configuration error' };
  }

  // Sign token exchange request with platform member key
  const authToken = getAuthToken({
    privateKeyWif: memberWif,
    requestPath: '/api/oauth/token',
  });

  const authUrl = process.env.SIGMA_AUTH_URL || 'https://auth.sigmaidentity.com';

  // Exchange authorization code for access token
  const tokenResponse = await fetch(`${authUrl}/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Token': authToken,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}));
    set.status = tokenResponse.status;
    return { error: errorData.error || 'Token exchange failed', details: errorData };
  }

  return await tokenResponse.json();
}, {
  body: t.Object({
    code: t.String(),
    redirectUri: t.String(),
  }),
});
```

**Callback handler** (frontend):

```typescript
// src/components/SigmaCallback.tsx
export function SigmaCallback() {
  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  useEffect(() => {
    async function handleCallback() {
      // Verify CSRF state
      const savedState = sessionStorage.getItem('oauth_state');
      if (state !== savedState) {
        throw new Error('Invalid state');
      }
      sessionStorage.removeItem('oauth_state');

      // Call backend to exchange code
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.bitchatnitro.com';
      const response = await fetch(`${apiUrl}/oauth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirectUri: `${window.location.origin}/auth/sigma/callback`,
        }),
      });

      const tokenData = await response.json();

      // Fetch user info
      const authUrl = import.meta.env.VITE_SIGMA_AUTH_URL || 'https://auth.sigmaidentity.com';
      const userInfoResponse = await fetch(`${authUrl}/api/oauth/userinfo`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const userInfo = await userInfoResponse.json();

      // Store session and redirect
      // ... store userInfo and token in your state management
    }

    handleCallback();
  }, [code, state]);

  return <div>Authenticating...</div>;
}
```

### OAuth Callback Handler

The plugin expects a callback route that exchanges the authorization code for a token.

**Next.js API Route** (`app/api/auth/callback/route.ts`):
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Exchange code for token via backend
  const response = await fetch(`${AUTH_SERVER_URL}/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Token': getAuthToken({ /* platform member key */ }),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${SITE_URL}/api/auth/callback`,
    }),
  });

  const tokenData = await response.json();
  // Set session cookie and redirect
}
```

## Package Structure (Planned)

```
sigma-auth-client-plugin/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Main plugin export
│   ├── plugin.ts          # Better Auth client plugin
│   ├── types.ts           # TypeScript types
│   └── utils/
│       └── redirect.ts    # OAuth redirect helpers
├── tests/
│   └── plugin.test.ts
└── README.md
```

## Dependencies

Required packages:
- `better-auth` - Core auth framework (peer dependency)
- Optional: `sigma-auth-iframe-signer` for iframe integration

## Feature Flags

The plugin should support feature flags for optional functionality:

```typescript
sigmaClient({
  features: {
    subscription: true,    // Enable subscription endpoints
    providers: true,       // Enable OAuth provider support
    iframeSigner: false,   // Use iframe signer (requires sigma-auth-iframe-signer)
  }
})
```

## Environment Variables

### Required for All Projects

```bash
# Sigma Auth server URL
NEXT_PUBLIC_AUTH_SERVER_URL=https://auth.sigmaidentity.com
# or for Vite projects:
VITE_SIGMA_AUTH_URL=https://auth.sigmaidentity.com

# Your site URL (for OAuth callback)
NEXT_PUBLIC_SITE_URL=https://yourapp.com
# or for Vite:
VITE_SITE_URL=https://yourapp.com

# Platform member private key (SERVER-SIDE ONLY - never expose to client!)
SIGMA_MEMBER_PRIVATE_KEY=L1abc...def789  # WIF format
# or for backend projects:
BITCHAT_MEMBER_WIF=L1abc...def789
```

### How to Get Platform Member Key

1. **Generate Bitcoin key pair** (or use existing)
```bash
# Using @bsv/sdk
bun run generate-key.ts
```

2. **Register your platform with Sigma Auth**

Contact Sigma Auth team or use the platform registration UI at `auth.sigmaidentity.com/dashboard/clients` to register your platform's public key.

3. **Store the WIF** in environment variables (server-side only)

The auth server will extract your pubkey from the `X-Auth-Token` signature during token exchange to identify your platform.

### Security Notes

- ⚠️ **NEVER expose `SIGMA_MEMBER_PRIVATE_KEY` to the client**
- ⚠️ Only use this key in API routes or backend servers
- ⚠️ Add to `.gitignore` and use environment variable management (Vercel, Railway, etc.)

## Platform Registration

Before your application can use Sigma Auth, you must register your platform:

### What Gets Registered

- **Platform name** - Display name for your application
- **Platform pubkey** - Derived from your member private key
- **Redirect URIs** - Allowed callback URLs (whitelist for security)
- **Optional: BAP ID** - On-chain identity for your platform

### Registration Flow

The platform is identified by the **pubkey extracted from the `X-Auth-Token` signature**, not by a traditional `client_id`.

**During token exchange:**
1. Your backend signs the request with `SIGMA_MEMBER_PRIVATE_KEY`
2. Sigma Auth extracts pubkey from signature
3. Sigma Auth looks up platform by pubkey in database
4. If found, token exchange proceeds
5. If not found, returns `invalid_client` error

### Manual Registration (For Development)

If self-hosting `sigma-auth`:

```sql
-- Insert your platform into oauth_clients table
INSERT INTO oauth_clients (
  id,
  name,
  pubkey,
  redirect_uris,
  created_at
) VALUES (
  'your-platform-id',
  'Your Platform Name',
  '03abc...def', -- Your public key
  ARRAY['https://yourapp.com/callback'],
  NOW()
);
```

### Troubleshooting Platform Registration

**Error: "invalid_client" or "Platform not registered"**
- Your platform pubkey is not in the database
- Check that `SIGMA_MEMBER_PRIVATE_KEY` is correct
- Verify you've registered with Sigma Auth team

**Error: "redirect_uri mismatch"**
- Your callback URL is not in the allowed `redirect_uris` list
- Update your platform registration with the correct callback URL

## Related Projects

- **sigma-auth-web** (`~/code/sigma-auth-web`) - Full-featured client implementation
  - Entry points: `lib/auth-client.ts`, `lib/sigma-client-plugin.ts`, `app/api/auth/callback/route.ts`, `app/callback/page.tsx`

- **allaboard-bitchat-nitro** (`~/code/allaboard-bitchat-nitro`) - Minimal client implementation
  - Entry points: `src/lib/auth-client.ts`, `src/lib/sigma-client-plugin.ts`, `src/components/authForm/SigmaCallback.tsx`

- **nitro-api** (`~/code/nitro-api`) - Elysia backend with OAuth token exchange
  - Entry point: `src/index.tsx` (search for `/oauth/exchange` endpoint)

- **droplit** (`~/code/droplit`) - Client with redirect-based signing
  - Entry points: `lib/sigma-client.ts`

- **sigma-auth-server-plugin** (`~/code/sigma-auth-server-plugin`) - Server plugin
- **sigma-auth-iframe-signer** (`~/code/sigma-auth-iframe-signer`) - Iframe signer package

## Migration Guide

### From Custom Implementation to Plugin

**Before:**
```typescript
// Custom OAuth redirect logic
const redirectToSigma = () => {
  const params = new URLSearchParams({
    client_id: 'my-app',
    redirect_uri: `${window.location.origin}/callback`,
    response_type: 'code',
  });
  window.location.href = `${SIGMA_AUTH_URL}/api/oauth/authorize?${params}`;
};
```

**After:**
```typescript
import { authClient } from './auth-client';

// Plugin handles OAuth redirect
authClient.signIn.sigma();
```

## License

MIT (or match sigma-auth licensing)
