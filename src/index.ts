import type { BetterAuthClientPlugin } from "better-auth/client";
import type { BetterFetchOption } from "@better-fetch/fetch";

export const sigmaClient = () => {
	return {
		id: "sigma",

		getActions: ($fetch) => {
			return {
				sigma: {
					signIn: async (
						data: { authToken: string },
						fetchOptions?: BetterFetchOption,
					) => {
						return await $fetch("/api/auth/sign-in/sigma", {
							method: "POST",
							headers: {
								"X-Auth-Token": data.authToken,
							},
							...fetchOptions,
						});
					},
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
