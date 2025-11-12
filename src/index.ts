import type { BetterAuthClientPlugin } from "better-auth/client";

export const sigmaClient = <T extends Record<string, unknown> = Record<string, never>>(): BetterAuthClientPlugin<T> => ({
	id: "sigma",
	$InferServerPlugin: {} as T,

	getActions: ($fetch) => ({
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
