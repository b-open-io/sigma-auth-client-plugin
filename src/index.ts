import type { BetterAuthClientPlugin } from "better-auth/client";

export const sigmaClient = () => {
	return {
		id: "sigma",

		getActions: (_$fetch) => {
			return {
				signIn: {
					sigma: (options?: {
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
