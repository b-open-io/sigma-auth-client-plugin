import type { BetterFetchOption } from "@better-fetch/fetch";
import type { BetterAuthClientPlugin } from "better-auth/client";
import type { SubscriptionStatus } from "./types";

// Re-export types for user convenience
export type { SubscriptionStatus } from "./types";
export type OAuthProvider = "github" | "apple" | "twitter";

// Export action types for proper TypeScript inference
export interface SigmaSignInOptions {
	authToken?: string;
	callbackURL?: string;
	errorCallbackURL?: string;
	provider?: string;
	clientId?: string;
	disableRedirect?: boolean;
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

						if (typeof window !== "undefined") {
							sessionStorage.setItem("oauth_state", state);
						}

						const authUrl =
							typeof process !== "undefined"
								? process.env.NEXT_PUBLIC_SIGMA_AUTH_URL ||
									"https://auth.sigmaidentity.com"
								: "https://auth.sigmaidentity.com";

						const redirectUri =
							options?.callbackURL ||
							`${typeof window !== "undefined" ? window.location.origin : ""}/callback`;

						const params = new URLSearchParams({
							redirect_uri: redirectUri,
							response_type: "code",
							state,
							scope: "read",
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
