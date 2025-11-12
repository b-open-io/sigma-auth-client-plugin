import type { BetterAuthClientPlugin } from "better-auth/client";
import type { SubscriptionStatus } from "./types";

// Re-export types for user convenience
export type { SubscriptionStatus } from "./types";
export type OAuthProvider = "github" | "apple" | "twitter";

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
					sigma: (options?: {
						clientId?: string;
						callbackURL?: string;
						errorCallbackURL?: string;
						provider?: string;
					}) => {
						// OAuth authorization flow - redirects to auth.sigmaidentity.com
						// User authenticates with their Bitcoin keys on Sigma's domain only
						// Platform member key signature happens on the auth SERVER during token exchange

						// Generate state for CSRF protection
						const state = Math.random().toString(36).substring(7);

						if (typeof window !== "undefined") {
							sessionStorage.setItem("oauth_state", state);
						}

						// Get auth server URL from environment or use default
						const authUrl =
							typeof process !== "undefined"
								? process.env.NEXT_PUBLIC_SIGMA_AUTH_URL ||
									"https://auth.sigmaidentity.com"
								: "https://auth.sigmaidentity.com";

						const redirectUri =
							options?.callbackURL ||
							`${typeof window !== "undefined" ? window.location.origin : ""}/callback`;

						// Build OAuth authorization URL
						const params = new URLSearchParams({
							redirect_uri: redirectUri,
							response_type: "code",
							state,
							scope: "read",
						});

						// Add client_id if specified
						if (options?.clientId) {
							params.append("client_id", options.clientId);
						}

						// Add provider if specified (for GitHub/Google OAuth via Sigma)
						if (options?.provider) {
							params.append("provider", options.provider);
						}

						// Redirect to OAuth authorization endpoint
						const fullAuthUrl = `${authUrl}/api/oauth/authorize?${params.toString()}`;

						if (typeof window !== "undefined") {
							window.location.href = fullAuthUrl;
						}

						// Return a promise that won't resolve since we're redirecting
						return new Promise(() => {
							// Redirecting - promise intentionally never resolves
						});
					},
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
