import type { BetterFetchOption } from "@better-fetch/fetch";
import type { BetterAuthClientPlugin } from "better-auth/client";
import type { SigmaUserInfo } from "./token-exchange";
import type { SubscriptionStatus } from "./types";

// Re-export types for user convenience
export type { SubscriptionStatus } from "./types";
export type OAuthProvider = "github" | "apple" | "twitter";

// Re-export server-side token exchange utilities and types
export {
	type BAPProfile,
	exchangeCodeForTokens,
	type SigmaUserInfo,
	type TokenExchangeError,
	type TokenExchangeOptions,
	type TokenExchangeResult,
} from "./token-exchange";

// Export action types for proper TypeScript inference
export interface SigmaSignInOptions {
	authToken?: string;
	bapId?: string; // Selected BAP identity ID (for multi-identity wallets)
	callbackURL?: string;
	errorCallbackURL?: string;
	provider?: string;
	clientId?: string;
	disableRedirect?: boolean;
}

// PKCE helper functions
const generateCodeVerifier = () => {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return btoa(String.fromCharCode(...array))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
};

const generateCodeChallenge = async (verifier: string) => {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
};

export interface OAuthCallbackResult {
	user: SigmaUserInfo;
	access_token: string;
	refresh_token?: string;
}

export interface OAuthCallbackError {
	title: string;
	message: string;
}

export const sigmaClient = () => {
	return {
		id: "sigma",

		getActions: ($fetch) => {
			return {
				subscription: {
					getStatus: async (): Promise<SubscriptionStatus> => {
						const res = await $fetch<SubscriptionStatus>(
							"/subscription/status",
							{
								method: "GET",
							},
						);
						if (res.error) {
							throw new Error(
								res.error.message || "Failed to fetch subscription status",
							);
						}
						return res.data as SubscriptionStatus;
					},
				},
				signIn: {
					sigma: async (
						options?: SigmaSignInOptions,
						fetchOptions?: BetterFetchOption,
					) => {
						// Two modes:
						// 1. With authToken: Call local endpoint (for auth server login)
						// 2. Without authToken: OAuth redirect (for external clients)
						if (options?.authToken) {
							// Auth server local sign-in - call endpoint with authToken
							const res = await $fetch("/sign-in/sigma", {
								method: "POST",
								body: {},
								headers: {
									"X-Auth-Token": options.authToken,
								},
								...fetchOptions,
							});
							return res;
						}

						// External OAuth client - redirect to auth server
						const state = Math.random().toString(36).substring(7);

						// Generate PKCE parameters for public clients
						const codeVerifier = generateCodeVerifier();
						const codeChallenge = await generateCodeChallenge(codeVerifier);

						const authUrl =
							typeof process !== "undefined"
								? process.env.NEXT_PUBLIC_SIGMA_AUTH_URL ||
									"https://auth.sigmaidentity.com"
								: "https://auth.sigmaidentity.com";

						// Ensure redirect_uri is always absolute (OAuth requires absolute URLs)
						const origin =
							typeof window !== "undefined" ? window.location.origin : "";
						const callbackPath = options?.callbackURL || "/callback";
						const redirectUri = callbackPath.startsWith("http")
							? callbackPath
							: `${origin}${callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`}`;

						const clientId = options?.clientId || "unknown";

						// Save OAuth state for callback verification
						if (typeof window !== "undefined") {
							sessionStorage.setItem("oauth_state", state);
							sessionStorage.setItem("pkce_verifier", codeVerifier);
							sessionStorage.setItem("oauth_redirect_uri", redirectUri);
							sessionStorage.setItem("oauth_client_id", clientId);
						}

						const params = new URLSearchParams({
							redirect_uri: redirectUri,
							response_type: "code",
							state,
							scope: "openid profile bsv:tools",
							code_challenge: codeChallenge,
							code_challenge_method: "S256",
						});

						if (clientId) {
							params.append("client_id", clientId);
						}

						if (options?.provider) {
							params.append("provider", options.provider);
						}

						// Use custom authorize endpoint that checks wallet unlock before proceeding
						// See /app/api/oauth2/authorize/route.ts on auth server
						const fullAuthUrl = `${authUrl}/oauth2/authorize?${params.toString()}`;

						if (typeof window !== "undefined") {
							window.location.href = fullAuthUrl;
						}

						return new Promise(() => {});
					},
				},
				sigma: {
					/**
					 * Handle OAuth callback after redirect from auth server
					 * Verifies state, exchanges code for tokens, and returns user data
					 *
					 * @param searchParams - URL search params from callback (code, state, error)
					 * @returns Promise resolving to user data and tokens
					 * @throws OAuthCallbackError if callback fails
					 */
					handleCallback: async (
						searchParams: URLSearchParams,
					): Promise<OAuthCallbackResult> => {
						// Check for OAuth error
						const error = searchParams.get("error");
						if (error) {
							const errorDescription = searchParams.get("error_description");
							throw {
								title: "Authentication Error",
								message:
									errorDescription ||
									error ||
									"An unknown error occurred during authentication.",
							} as OAuthCallbackError;
						}

						// Check for authorization code
						const code = searchParams.get("code");
						const state = searchParams.get("state");

						if (!code) {
							throw {
								title: "Missing Authorization Code",
								message:
									"The authorization code was not received from the authentication server.",
							} as OAuthCallbackError;
						}

						// Get saved OAuth state from sessionStorage
						const savedState =
							typeof window !== "undefined"
								? sessionStorage.getItem("oauth_state")
								: null;
						const savedRedirectUri =
							typeof window !== "undefined"
								? sessionStorage.getItem("oauth_redirect_uri")
								: null;
						const savedClientId =
							typeof window !== "undefined"
								? sessionStorage.getItem("oauth_client_id")
								: null;

						// Verify state for CSRF protection
						const verifyState = savedState;

						if (state !== verifyState) {
							// Clear invalid state
							if (typeof window !== "undefined") {
								sessionStorage.removeItem("oauth_state");
								sessionStorage.removeItem("oauth_redirect_uri");
								sessionStorage.removeItem("oauth_client_id");
							}

							throw {
								title: "Security Error",
								message: `Invalid state parameter. Please try signing in again.`,
							} as OAuthCallbackError;
						}

						// Get PKCE verifier
						const codeVerifier =
							typeof window !== "undefined"
								? sessionStorage.getItem("pkce_verifier") || undefined
								: undefined;

						// Clear session storage after retrieving values
						if (typeof window !== "undefined") {
							sessionStorage.removeItem("oauth_state");
							sessionStorage.removeItem("pkce_verifier");
							sessionStorage.removeItem("oauth_redirect_uri");
							sessionStorage.removeItem("oauth_client_id");
						}

						// Exchange code for tokens DIRECTLY with auth server (public client with PKCE)
						// No backend proxy needed - this is standard OAuth 2.0 public client flow
						try {
							const authUrl =
								typeof process !== "undefined"
									? process.env.NEXT_PUBLIC_SIGMA_AUTH_URL ||
										"https://auth.sigmaidentity.com"
									: "https://auth.sigmaidentity.com";

							// Build token request parameters
							const tokenParams = new URLSearchParams({
								grant_type: "authorization_code",
								code,
								redirect_uri: savedRedirectUri || window.location.origin + "/callback",
								client_id: savedClientId || "unknown",
							});

							// Add PKCE verifier if available
							if (codeVerifier) {
								tokenParams.append("code_verifier", codeVerifier);
							}

							const tokenResponse = await fetch(
								`${authUrl}/api/auth/oauth2/token`,
								{
									method: "POST",
									headers: {
										"Content-Type": "application/x-www-form-urlencoded",
									},
									body: tokenParams.toString(),
								},
							);

							if (!tokenResponse.ok) {
								let errorMessage =
									"Failed to exchange authorization code for access token.";
								let errorTitle = "Token Exchange Failed";

								try {
									const errorData = await tokenResponse.json();

									if (errorData.error_description) {
										errorMessage = errorData.error_description;
									} else if (errorData.error) {
										errorMessage = errorData.error;
									}

									if (errorData.error === "invalid_client") {
										errorTitle = "Client Not Registered";
										errorMessage =
											"This application is not registered with Sigma Identity.";
									} else if (errorData.error === "invalid_grant") {
										errorTitle = "Invalid Authorization Code";
										errorMessage =
											"The authorization code is invalid or expired. Please try again.";
									}
								} catch {
									// Use default error message
								}

								throw {
									title: errorTitle,
									message: errorMessage,
								} as OAuthCallbackError;
							}

							const tokens = await tokenResponse.json();

							// Get user info with the access token
							const userInfoResponse = await fetch(
								`${authUrl}/api/auth/oauth2/userinfo`,
								{
									headers: {
										Authorization: `Bearer ${tokens.access_token}`,
									},
								},
							);

							if (!userInfoResponse.ok) {
								throw {
									title: "User Info Failed",
									message: "Failed to retrieve user information from Sigma.",
								} as OAuthCallbackError;
							}

							const userInfo = await userInfoResponse.json();

							return {
								user: userInfo,
								access_token: tokens.access_token,
								refresh_token: tokens.refresh_token,
							};
						} catch (err) {
							// If already an OAuthCallbackError, rethrow
							if (
								typeof err === "object" &&
								err !== null &&
								"title" in err &&
								"message" in err
							) {
								throw err;
							}

							// Otherwise wrap in error object
							throw {
								title: "Authentication Failed",
								message:
									err instanceof Error
										? err.message
										: "An unknown error occurred.",
							} as OAuthCallbackError;
						}
					},
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
