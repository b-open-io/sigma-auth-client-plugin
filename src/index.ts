import type { BetterFetchOption } from "@better-fetch/fetch";
import type { BetterAuthClientPlugin } from "better-auth/client";
import type { SubscriptionStatus } from "./types";

// Re-export types for user convenience
export type { SubscriptionStatus } from "./types";
export type OAuthProvider = "github" | "apple" | "twitter";

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

						if (typeof window !== "undefined") {
							sessionStorage.setItem("oauth_state", state);
							sessionStorage.setItem("pkce_verifier", codeVerifier);
						}

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

						const params = new URLSearchParams({
							redirect_uri: redirectUri,
							response_type: "code",
							state,
							scope: "openid profile bsv:tools",
							code_challenge: codeChallenge,
							code_challenge_method: "S256",
							prompt: "consent", // Always show consent page to check wallet unlock status
						});

						if (options?.clientId) {
							params.append("client_id", options.clientId);
						}

						if (options?.provider) {
							params.append("provider", options.provider);
						}

						const fullAuthUrl = `${authUrl}/api/auth/oauth2/authorize?${params.toString()}`;

						if (typeof window !== "undefined") {
							window.location.href = fullAuthUrl;
						}

						return new Promise(() => {});
					},
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
