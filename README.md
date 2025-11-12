# @sigma-auth/client-plugin

Better Auth client plugin for Bitcoin-based OAuth authentication with Sigma Identity.

## What is Sigma Identity?

Sigma Identity (`auth.sigmaidentity.com`) is a **centralized OAuth provider** for Bitcoin-based authentication - like "Sign in with Google" or "Sign in with GitHub", but for Bitcoin identities.

**Your users' private keys NEVER leave Sigma's domain.** Your application receives OAuth tokens, just like any other OAuth provider.

## Installation

```bash
npm install @sigma-auth/client-plugin
# or
bun add @sigma-auth/client-plugin
```

## Setup

### Add the Client Plugin

```ts title="auth-client.ts"
import { createAuthClient } from "better-auth/react";
import { sigmaClient } from "@sigma-auth/client-plugin";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000", // Your API base URL
  plugins: [sigmaClient()],
});
```

## Usage

### Sign In with Sigma (Basic)

```tsx title="SignInButton.tsx"
import { authClient } from "./auth-client";

export function SignInButton() {
  return (
    <button onClick={() => authClient.signIn.sigma()}>
      Sign in with Sigma
    </button>
  );
}
```

This redirects the user to `auth.sigmaidentity.com` where they authenticate with their Bitcoin wallet, then redirects back to your app with an OAuth authorization code.

### Sign In with Provider

Sigma Identity supports OAuth providers like GitHub, Google, etc.:

```tsx
<button onClick={() => authClient.signIn.sigma({ provider: 'github' })}>
  Sign in with GitHub via Sigma
</button>
```

### Custom Callback URL

```tsx
<button
  onClick={() => authClient.signIn.sigma({
    callbackURL: 'https://myapp.com/auth/callback'
  })}
>
  Sign in with Sigma
</button>
```

## OAuth Flow

1. User clicks "Sign in with Sigma" button
2. Client plugin redirects to `auth.sigmaidentity.com/api/oauth/authorize`
3. User authenticates on Sigma's domain (private keys never leave Sigma)
4. Sigma redirects back to your app with authorization code
5. Your server exchanges code for access token
6. User is authenticated

**Note:** Your users' Bitcoin private keys are managed by Sigma Identity and NEVER exposed to your application.

## API Reference

### `sigmaClient()`

Creates the Sigma Auth client plugin for Better Auth.

```ts
const plugin = sigmaClient();
```

### `authClient.signIn.sigma(options?)`

Initiates the OAuth flow by redirecting to Sigma Identity's authorization endpoint.

**Parameters:**
- `options.callbackURL` (string, optional) - Custom callback URL. Defaults to `${window.location.origin}/callback`
- `options.provider` (string, optional) - OAuth provider to use via Sigma (`'github'`, `'google'`, etc.)
- `options.errorCallbackURL` (string, optional) - URL to redirect to on error

**Returns:** Promise that never resolves (redirects away from page)

## Server Setup

This plugin requires a corresponding Better Auth server plugin that handles the OAuth token exchange. See [@sigma-auth/server-plugin](https://github.com/b-open-io/sigma-auth-server-plugin) for server-side setup.

Your server needs to:
1. Provide a callback endpoint to receive the authorization code
2. Exchange the code for an access token with Sigma Identity
3. Create a user session

## Environment Variables

```bash
# Optional: Custom Sigma Auth server URL (defaults to https://auth.sigmaidentity.com)
NEXT_PUBLIC_SIGMA_AUTH_URL=https://auth.sigmaidentity.com

# Or for Vite projects:
VITE_SIGMA_AUTH_URL=https://auth.sigmaidentity.com
```

## TypeScript

Full TypeScript support included:

```typescript
import type { BetterAuthClientPlugin } from "better-auth/client";

const plugin: BetterAuthClientPlugin = sigmaClient();
```

## Requirements

- **better-auth** ^1.3.34 (peer dependency)
- A Better Auth server with [@sigma-auth/server-plugin](https://github.com/b-open-io/sigma-auth-server-plugin)

## Security

- ✅ Private keys never leave Sigma Identity's domain
- ✅ CSRF protection via state parameter
- ✅ Standard OAuth 2.0 authorization code flow
- ✅ No secrets or sensitive data in client code

## Related Packages

- [@sigma-auth/server-plugin](https://github.com/b-open-io/sigma-auth-server-plugin) - Server-side Better Auth plugin
- [Sigma Identity](https://auth.sigmaidentity.com) - Centralized Bitcoin OAuth provider

## License

MIT
