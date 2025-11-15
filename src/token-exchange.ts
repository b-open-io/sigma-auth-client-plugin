import type { User } from "better-auth";
import { getAuthToken } from "bitcoin-auth";

export interface TokenExchangeOptions {
	code: string;
	redirectUri: string;
	clientId: string;
	memberPrivateKey: string;
	codeVerifier?: string;
	issuerUrl?: string;
}

/**
 * BAP Profile structure from api.sigmaidentity.com
 * Stored in profile.profile JSONB column
 */
export interface BAPProfile {
	id?: string; // BAP identity key (e.g. "A4PYmuKGG61WCjjBaRpuSEbqytG")
	rootAddress?: string; // Root Bitcoin address
	currentAddress?: string; // Current Bitcoin address
	identity?: {
		"@context"?: string; // Schema.org context
		"@type"?: string; // Schema.org type (e.g. "Person")
		alternateName?: string; // Display name/username
		givenName?: string; // First name
		familyName?: string; // Last name
		image?: string; // Profile image URL
		banner?: string; // Banner image URL
		description?: string; // Bio/description
		[key: string]: unknown; // Additional schema.org fields
	};
	[key: string]: unknown; // Additional BAP fields
}

/**
 * OIDC userinfo response with Sigma Identity extensions
 * Extends Better Auth's User type with BAP-specific fields
 *
 * Standard OIDC claims:
 * - sub, name, given_name, family_name, picture
 *
 * Custom claims:
 * - pubkey: Bitcoin public key for this identity
 * - bap: Full BAP identity from api.sigmaidentity.com/blockchain
 */
export interface SigmaUserInfo extends Omit<User, "id"> {
	// OIDC standard claims
	sub: string; // User ID (maps to User.id)
	given_name?: string; // From bap.identity.givenName
	family_name?: string | null; // From bap.identity.familyName
	picture?: string | null; // From bap.identity.image

	// Custom claims
	pubkey: string; // Bitcoin public key
	bap?: BAPProfile | null; // Full BAP identity data
}

export interface TokenExchangeResult {
	user: SigmaUserInfo;
	access_token: string;
	refresh_token?: string;
}

export interface TokenExchangeError {
	error: string;
	details?: string;
	status?: number;
	endpoint?: string;
}

/**
 * Exchange OAuth authorization code for access token
 * This function MUST be called server-side only as it requires the member private key
 *
 * @param options - Token exchange configuration
 * @returns Promise resolving to user data and tokens
 * @throws TokenExchangeError if exchange fails
 */
export async function exchangeCodeForTokens(
	options: TokenExchangeOptions,
): Promise<TokenExchangeResult> {
	const {
		code,
		redirectUri,
		clientId,
		memberPrivateKey,
		codeVerifier,
		issuerUrl = "https://auth.sigmaidentity.com",
	} = options;

	// Build token request body
	const bodyParams: Record<string, string> = {
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: clientId,
	};

	if (codeVerifier) {
		bodyParams.code_verifier = codeVerifier;
	}

	const requestBody = new URLSearchParams(bodyParams).toString();

	// Create signed auth token using bitcoin-auth
	// CRITICAL: Must include body in signature to prevent request tampering
	const authToken = getAuthToken({
		privateKeyWif: memberPrivateKey,
		requestPath: "/oauth2/token",
		body: requestBody,
	});

	// Exchange code for tokens
	const tokenResponse = await fetch(`${issuerUrl}/api/auth/oauth2/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"X-Auth-Token": authToken,
		},
		body: requestBody,
	});

	if (!tokenResponse.ok) {
		const errorData = await tokenResponse.text();
		throw {
			error: "Token exchange failed",
			details: errorData,
			status: tokenResponse.status,
			endpoint: "/api/auth/oauth2/token",
		} as TokenExchangeError;
	}

	const tokens = await tokenResponse.json();

	// Get user info with the access token
	const userInfoResponse = await fetch(
		`${issuerUrl}/api/auth/oauth2/userinfo`,
		{
			headers: {
				Authorization: `Bearer ${tokens.access_token}`,
			},
		},
	);

	if (!userInfoResponse.ok) {
		const userInfoError = await userInfoResponse.text();
		throw {
			error: "Failed to get user info",
			details: userInfoError,
			status: userInfoResponse.status,
			endpoint: "/api/auth/oauth2/userinfo",
		} as TokenExchangeError;
	}

	const userInfo = await userInfoResponse.json();

	return {
		user: userInfo,
		access_token: tokens.access_token,
		refresh_token: tokens.refresh_token,
	};
}
