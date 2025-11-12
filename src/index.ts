import type { BetterFetchOption } from "@better-fetch/fetch";
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
					sigma: async (
						options?: {
							authToken?: string;
							callbackURL?: string;
							errorCallbackURL?: string;
							provider?: string;
							clientId?: string;
							disableRedirect?: boolean;
						},
						fetchOptions?: BetterFetchOption,
					) => {
						// Call server endpoint following Better Auth pattern
						// Server handles OAuth redirect or direct sign-in based on context
						const res = await $fetch("/sign-in/sigma", {
							method: "POST",
							body: {
								callbackURL: options?.callbackURL,
								errorCallbackURL: options?.errorCallbackURL,
								provider: options?.provider,
								clientId: options?.clientId,
								disableRedirect: options?.disableRedirect,
							},
							headers: options?.authToken
								? {
										"X-Auth-Token": options.authToken,
									}
								: undefined,
							...fetchOptions,
						});

						return res;
					},
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
