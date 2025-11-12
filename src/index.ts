import type { BetterAuthClientPlugin } from "better-auth/client";

export const sigmaClient = (): BetterAuthClientPlugin => ({
	id: "sigma",

	getActions: ($fetch: typeof fetch) => ({
		sigma: {
			signIn: async (data: { authToken: string }) => {
				const res = await $fetch("/api/auth/sign-in/sigma", {
					method: "POST",
					headers: {
						"X-Auth-Token": data.authToken,
					},
				});

				return res;
			},
		},
	}),
});
