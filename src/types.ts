/**
 * Type definitions for Sigma Auth client plugin
 */

export interface SigmaClientConfig {
  /**
   * Sigma auth server URL
   * @default https://auth.sigmaidentity.com
   */
  authServerUrl?: string;

  /**
   * OAuth callback URL (where to redirect after authentication)
   * Defaults to current origin + /callback
   */
  callbackUrl?: string;

  /**
   * Enable subscription features
   * Adds subscription management endpoints
   * @default false
   */
  enableSubscription?: boolean;

  /**
   * Enable OAuth provider support (GitHub, Google, etc.)
   * @default true
   */
  enableProviders?: boolean;
}

/**
 * OAuth provider types
 */
export type OAuthProvider = 'github' | 'google' | 'handcash';

/**
 * Sign-in options
 */
export interface SignInOptions {
  /**
   * Custom callback URL for this sign-in
   * Overrides default config
   */
  callbackUrl?: string;

  /**
   * OAuth provider to use (GitHub, Google, etc.)
   * When provided, redirects to provider OAuth flow
   */
  provider?: OAuthProvider;

  /**
   * Additional query parameters for OAuth flow
   */
  params?: Record<string, string>;
}

/**
 * Subscription status response
 */
export interface SubscriptionStatus {
  tier: string;
  active: boolean;
  expiresAt?: number;
  features?: string[];
}

/**
 * Update subscription data
 */
export interface UpdateSubscriptionData {
  tier?: string;
  tokenAddress?: string;
}
