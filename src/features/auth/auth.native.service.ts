import type { PrismaClient } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { type AuthUser, publicUser, syncProfile } from './auth.service.js';

/**
 * Auth for native clients (mobile). It talks to the Supabase Auth REST API (GoTrue) directly instead of the request's SSR client, so
 * nothing is ever written to cookies: the session goes back to the app in the response body and lives in its secure store.
 * Tokens, codes and verifiers are never logged.
 */

export type NativeAuthConfig = {
	/** Where Supabase sends the browser back after Google sign-in. Must be listed in Supabase → Redirect URLs. */
	NATIVE_AUTH_REDIRECT_URL?: string;
	SUPABASE_PUBLISHABLE_KEY: string;
	SUPABASE_URL: string;
};

export const DEFAULT_NATIVE_REDIRECT_URL = 'usegonche://auth/callback';

type GoTrueUser = AuthUser & { identities?: { provider: string }[] };
type GoTrueSession = { access_token: string; expires_at?: number; expires_in: number; refresh_token: string; user: GoTrueUser };

export type NativeSession = {
	accessToken: string;
	/** Unix time (seconds) when the access token expires. */
	expiresAt: number;
	refreshToken: string;
	user: { email?: string; id: string };
};

type Fetch = typeof fetch;

class GoTrueError extends Error {
	constructor(
		readonly status: number,
		readonly errorCode: string | undefined
	) {
		super(`gotrue ${status} ${errorCode ?? ''}`);
	}
}

async function gotrue<T>(config: NativeAuthConfig, fetchFn: Fetch, path: string, init: { accessToken?: string; body?: unknown; method?: string } = {}): Promise<T> {
	const headers: Record<string, string> = { apikey: config.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
	if (init.accessToken) headers.Authorization = `Bearer ${init.accessToken}`;
	const res = await fetchFn(`${config.SUPABASE_URL}/auth/v1${path}`, {
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		headers,
		method: init.method ?? 'POST',
	});
	const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	if (!res.ok) {
		const code = json.error_code ?? json.code;
		throw new GoTrueError(res.status, typeof code === 'string' ? code : undefined);
	}
	return json as T;
}

const providersOf = (user: GoTrueUser): Set<string> => new Set((user.identities ?? []).map(identity => identity.provider));

const toNativeSession = (session: GoTrueSession): NativeSession => ({
	accessToken: session.access_token,
	expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
	refreshToken: session.refresh_token,
	user: publicUser(session.user),
});

/** Revokes the session of an access token (scope `local`: only that device; `others`: every other session of the user). */
async function revoke(config: NativeAuthConfig, fetchFn: Fetch, accessToken: string, scope: 'local' | 'others' = 'local'): Promise<void> {
	await gotrue(config, fetchFn, `/logout?scope=${scope}`, { accessToken });
}

/** Common tail of every sign-in: one account = one sign-in method (the session is revoked otherwise), then the profile sync. */
async function signedIn(prisma: PrismaClient, config: NativeAuthConfig, fetchFn: Fetch, session: GoTrueSession): Promise<NativeSession> {
	if (providersOf(session.user).size > 1) {
		await revoke(config, fetchFn, session.access_token).catch(() => undefined);
		throw new AppError('provider_conflict', 409);
	}
	await syncProfile(prisma, session.user);
	return toNativeSession(session);
}

export async function nativeLogin(prisma: PrismaClient, config: NativeAuthConfig, input: { email: string; password: string }, fetchFn: Fetch = fetch): Promise<NativeSession> {
	let session: GoTrueSession;
	try {
		session = await gotrue<GoTrueSession>(config, fetchFn, '/token?grant_type=password', { body: input });
	} catch (error) {
		if (error instanceof GoTrueError && error.errorCode === 'email_not_confirmed') throw new AppError('email_not_confirmed', 403);
		// Same answer for an unknown email and a wrong password: no account enumeration.
		throw new AppError('invalid_credentials', 401);
	}
	return signedIn(prisma, config, fetchFn, session);
}

/** Creates the account; Supabase emails a confirmation code. Same answer whether or not the email is already registered. */
export async function nativeSignup(config: NativeAuthConfig, input: { displayName: string; email: string; password: string }, fetchFn: Fetch = fetch): Promise<void> {
	try {
		await gotrue(config, fetchFn, '/signup', { body: { data: { display_name: input.displayName }, email: input.email, password: input.password } });
	} catch (error) {
		if (error instanceof GoTrueError && error.errorCode === 'weak_password') throw new AppError('weak_password', 422);
		// The client only gets `signup_failed` (no account enumeration); the real cause goes to the server log.
		console.error('native signup failed', error instanceof GoTrueError ? { code: error.errorCode, status: error.status } : { error: String(error) });
		throw new AppError('signup_failed', 400);
	}
}

/** Confirms the email with the code of the confirmation email and signs the user in. */
export async function nativeVerifyEmail(prisma: PrismaClient, config: NativeAuthConfig, input: { email: string; token: string }, fetchFn: Fetch = fetch): Promise<NativeSession> {
	let session: GoTrueSession;
	try {
		session = await gotrue<GoTrueSession>(config, fetchFn, '/verify', { body: { email: input.email, token: input.token, type: 'email' } });
	} catch {
		throw new AppError('invalid_or_expired_code', 400);
	}
	return signedIn(prisma, config, fetchFn, session);
}

/**
 * Trades a refresh token for a new pair. Supabase rotates refresh tokens and detects reuse: a used (outside the short reuse
 * interval), revoked or unknown token is rejected and, on reuse, the whole session is revoked.
 */
export async function nativeRefresh(config: NativeAuthConfig, refreshToken: string, fetchFn: Fetch = fetch): Promise<NativeSession> {
	try {
		return toNativeSession(await gotrue<GoTrueSession>(config, fetchFn, '/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } }));
	} catch {
		throw new AppError('unauthorized', 401);
	}
}

/** Revokes the session server side (its refresh token stops working). An expired or invalid access token answers 401 so the app refreshes first. */
export async function nativeLogout(config: NativeAuthConfig, accessToken: string, fetchFn: Fetch = fetch): Promise<void> {
	try {
		await revoke(config, fetchFn, accessToken);
	} catch (error) {
		// 404: the session no longer exists, which is what logout wants.
		if (error instanceof GoTrueError && error.status === 404) return;
		if (error instanceof GoTrueError && (error.status === 401 || error.status === 403)) throw new AppError('unauthorized', 401);
		throw error;
	}
}

/** Supabase authorize URL for Google with the device's PKCE challenge. The redirect is fixed by the server, never chosen by the client. */
export function nativeGoogleUrl(config: NativeAuthConfig, codeChallenge: string): string {
	const url = new URL(`${config.SUPABASE_URL}/auth/v1/authorize`);
	url.searchParams.set('provider', 'google');
	url.searchParams.set('redirect_to', config.NATIVE_AUTH_REDIRECT_URL ?? DEFAULT_NATIVE_REDIRECT_URL);
	url.searchParams.set('code_challenge', codeChallenge);
	url.searchParams.set('code_challenge_method', 's256');
	return url.toString();
}

/** Trades the Supabase auth code of the Google redirect + the device's verifier for a session. */
export async function nativeGoogleLogin(prisma: PrismaClient, config: NativeAuthConfig, input: { code: string; code_verifier: string }, fetchFn: Fetch = fetch): Promise<NativeSession> {
	let session: GoTrueSession;
	try {
		session = await gotrue<GoTrueSession>(config, fetchFn, '/token?grant_type=pkce', { body: { auth_code: input.code, code_verifier: input.code_verifier } });
	} catch {
		throw new AppError('invalid_or_expired_code', 400);
	}
	return signedIn(prisma, config, fetchFn, session);
}

/** Step 1 of password recovery: emails a one-time code. Never fails for an unknown email (no account enumeration). */
export async function nativeForgotPassword(config: NativeAuthConfig, email: string, fetchFn: Fetch = fetch): Promise<void> {
	await gotrue(config, fetchFn, '/recover', { body: { email } }).catch(error => {
		console.error('native recover failed', error instanceof GoTrueError ? { code: error.errorCode, status: error.status } : { error: String(error) });
	});
}

/**
 * Step 2: verifies the code, sets the new password, signs every other session out and returns a session for this device.
 * Only accounts that use a password may do this (a Google account never gains a password through recovery).
 */
export async function nativeResetPassword(prisma: PrismaClient, config: NativeAuthConfig, input: { email: string; password: string; token: string }, fetchFn: Fetch = fetch): Promise<NativeSession> {
	let session: GoTrueSession;
	try {
		session = await gotrue<GoTrueSession>(config, fetchFn, '/verify', { body: { email: input.email, token: input.token, type: 'recovery' } });
	} catch {
		throw new AppError('invalid_or_expired_code', 400);
	}

	const providers = providersOf(session.user);
	if (providers.size !== 1 || !providers.has('email')) {
		await revoke(config, fetchFn, session.access_token).catch(() => undefined);
		throw new AppError('invalid_or_expired_code', 400);
	}

	try {
		await gotrue(config, fetchFn, '/user', { accessToken: session.access_token, body: { password: input.password }, method: 'PUT' });
	} catch (error) {
		await revoke(config, fetchFn, session.access_token).catch(() => undefined);
		throw new AppError(error instanceof GoTrueError && error.errorCode === 'weak_password' ? 'weak_password' : 'reset_failed', 422);
	}

	await revoke(config, fetchFn, session.access_token, 'others').catch(() => undefined);
	await syncProfile(prisma, session.user);
	return toNativeSession(session);
}
