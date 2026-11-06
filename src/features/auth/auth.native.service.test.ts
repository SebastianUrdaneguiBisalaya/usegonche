import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { createMockPrisma, TEST_USER_ID } from '../../test/helpers.js';
import { nativeForgotPassword, nativeGoogleLogin, nativeGoogleUrl, nativeLogin, nativeLogout, nativeRefresh, nativeResetPassword, nativeSignup, nativeVerifyEmail } from './auth.native.service.js';

const config = { SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_URL: 'https://proj.supabase.co' };
const user = (providers: string[] = ['email']) => ({ email: 'a@b.co', id: TEST_USER_ID, identities: providers.map(provider => ({ provider })) });
const session = (providers?: string[]) => ({ access_token: 'at', expires_at: 1_900_000_000, expires_in: 3600, refresh_token: 'rt', user: user(providers) });
const native = { accessToken: 'at', expiresAt: 1_900_000_000, refreshToken: 'rt', user: { email: 'a@b.co', id: TEST_USER_ID } };

type Reply = { body?: unknown; status?: number };
/** Fake GoTrue: answers each call with the next reply (default 200 `{}`). */
const gotrue = (...replies: Reply[]) => {
	let i = 0;
	return vi.fn((_url: string | URL | Request, _init?: RequestInit) => {
		const { body = {}, status = 200 } = replies[i++] ?? {};
		return Promise.resolve({ json: () => Promise.resolve(body), ok: status < 400, status } as Response);
	});
};
const call = (fetchFn: ReturnType<typeof gotrue>, n = 0) => {
	const [url, init] = fetchFn.mock.calls[n] as [string, RequestInit];
	return { body: init.body ? JSON.parse(init.body as string) : undefined, headers: init.headers as Record<string, string>, method: init.method, url };
};
const rejectsWith = async (promise: Promise<unknown>, code: string, status: number) => {
	const error = await promise.catch(e => e);
	expect(error).toBeInstanceOf(AppError);
	expect(error).toMatchObject({ code, status });
};

describe('nativeLogin', () => {
	it('signs in with the password grant, syncs the profile and returns the session', async () => {
		const prisma = createMockPrisma();
		const fetchFn = gotrue({ body: session() });
		await expect(nativeLogin(prisma, config, { email: 'a@b.co', password: 'pw' }, fetchFn)).resolves.toEqual(native);
		expect(call(fetchFn)).toMatchObject({ body: { email: 'a@b.co', password: 'pw' }, headers: { apikey: 'pk' }, url: 'https://proj.supabase.co/auth/v1/token?grant_type=password' });
		expect(prisma.profile.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TEST_USER_ID } }));
	});

	it('computes expiresAt from expires_in when Supabase omits it', async () => {
		vi.useFakeTimers({ now: 1_000_000_000_000 });
		const { expires_at: _, ...noExpiresAt } = session();
		const result = await nativeLogin(createMockPrisma(), config, { email: 'a@b.co', password: 'pw' }, gotrue({ body: noExpiresAt }));
		expect(result.expiresAt).toBe(1_000_000_000 + 3600);
		vi.useRealTimers();
	});

	it('answers a generic invalid_credentials for any failure', async () => {
		await rejectsWith(
			nativeLogin(createMockPrisma(), config, { email: 'a@b.co', password: 'x' }, gotrue({ body: { error_code: 'invalid_credentials' }, status: 400 })),
			'invalid_credentials',
			401
		);
		await rejectsWith(nativeLogin(createMockPrisma(), config, { email: 'a@b.co', password: 'x' }, gotrue({ body: { error_code: 'user_not_found' }, status: 400 })), 'invalid_credentials', 401);
	});

	it('answers email_not_confirmed for an unconfirmed email', async () => {
		await rejectsWith(
			nativeLogin(createMockPrisma(), config, { email: 'a@b.co', password: 'x' }, gotrue({ body: { error_code: 'email_not_confirmed' }, status: 400 })),
			'email_not_confirmed',
			403
		);
	});

	it('revokes the session and answers provider_conflict when the account has two sign-in methods', async () => {
		const prisma = createMockPrisma();
		const fetchFn = gotrue({ body: session(['email', 'google']) }, { status: 204 });
		await rejectsWith(nativeLogin(prisma, config, { email: 'a@b.co', password: 'pw' }, fetchFn), 'provider_conflict', 409);
		expect(call(fetchFn, 1)).toMatchObject({ headers: { Authorization: 'Bearer at' }, url: 'https://proj.supabase.co/auth/v1/logout?scope=local' });
		expect(prisma.profile.upsert).not.toHaveBeenCalled();
	});
});

describe('nativeSignup', () => {
	it('sends the display name as metadata', async () => {
		const fetchFn = gotrue({ body: {} });
		await nativeSignup(config, { displayName: 'Ana', email: 'a@b.co', password: 'password123' }, fetchFn);
		expect(call(fetchFn)).toMatchObject({ body: { data: { display_name: 'Ana' }, email: 'a@b.co', password: 'password123' }, url: 'https://proj.supabase.co/auth/v1/signup' });
	});

	it('maps weak_password and hides any other cause behind signup_failed', async () => {
		const input = { displayName: 'Ana', email: 'a@b.co', password: 'password123' };
		await rejectsWith(nativeSignup(config, input, gotrue({ body: { error_code: 'weak_password' }, status: 422 })), 'weak_password', 422);
		const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		await rejectsWith(nativeSignup(config, input, gotrue({ body: { error_code: 'over_email_send_rate_limit' }, status: 429 })), 'signup_failed', 400);
		expect(JSON.stringify(log.mock.calls)).not.toContain('password123');
		log.mockRestore();
	});
});

describe('nativeVerifyEmail', () => {
	it('verifies the code and signs the user in', async () => {
		const fetchFn = gotrue({ body: session() });
		await expect(nativeVerifyEmail(createMockPrisma(), config, { email: 'a@b.co', token: '123456' }, fetchFn)).resolves.toEqual(native);
		expect(call(fetchFn).body).toEqual({ email: 'a@b.co', token: '123456', type: 'email' });
	});

	it('answers invalid_or_expired_code for a wrong code', async () => {
		await rejectsWith(nativeVerifyEmail(createMockPrisma(), config, { email: 'a@b.co', token: '000000' }, gotrue({ status: 403 })), 'invalid_or_expired_code', 400);
	});
});

describe('nativeRefresh', () => {
	it('rotates the pair', async () => {
		const fetchFn = gotrue({ body: { ...session(), refresh_token: 'rt2' } });
		await expect(nativeRefresh(config, 'rt', fetchFn)).resolves.toMatchObject({ refreshToken: 'rt2' });
		expect(call(fetchFn)).toMatchObject({ body: { refresh_token: 'rt' }, url: 'https://proj.supabase.co/auth/v1/token?grant_type=refresh_token' });
	});

	it('answers 401 for a reused, revoked or unknown refresh token', async () => {
		for (const error_code of ['refresh_token_already_used', 'refresh_token_not_found', 'session_not_found']) {
			await rejectsWith(nativeRefresh(config, 'rt', gotrue({ body: { error_code }, status: 400 })), 'unauthorized', 401);
		}
	});
});

describe('nativeLogout', () => {
	it('revokes the session server side', async () => {
		const fetchFn = gotrue({ status: 204 });
		await nativeLogout(config, 'at', fetchFn);
		expect(call(fetchFn)).toMatchObject({ headers: { Authorization: 'Bearer at' }, method: 'POST', url: 'https://proj.supabase.co/auth/v1/logout?scope=local' });
	});

	it('treats a session that no longer exists as signed out', async () => {
		await expect(nativeLogout(config, 'at', gotrue({ status: 404 }))).resolves.toBeUndefined();
	});

	it('answers 401 for an expired access token so the app refreshes first', async () => {
		await rejectsWith(nativeLogout(config, 'at', gotrue({ status: 401 })), 'unauthorized', 401);
	});
});

describe('nativeGoogleUrl', () => {
	const challenge = 'a'.repeat(43);

	it('builds the Supabase authorize URL with the challenge and the default app-scheme redirect', () => {
		const url = new URL(nativeGoogleUrl(config, challenge));
		expect(url.origin + url.pathname).toBe('https://proj.supabase.co/auth/v1/authorize');
		expect(Object.fromEntries(url.searchParams)).toEqual({ code_challenge: challenge, code_challenge_method: 's256', provider: 'google', redirect_to: 'usegonche://auth/callback' });
	});

	it('uses NATIVE_AUTH_REDIRECT_URL when it is set', () => {
		const url = new URL(nativeGoogleUrl({ ...config, NATIVE_AUTH_REDIRECT_URL: 'usegonche-dev://auth/callback' }, challenge));
		expect(url.searchParams.get('redirect_to')).toBe('usegonche-dev://auth/callback');
	});
});

describe('nativeGoogleLogin', () => {
	const input = { code: 'c', code_verifier: 'v'.repeat(43) };

	it('trades code + verifier with the PKCE grant and signs in', async () => {
		const fetchFn = gotrue({ body: session(['google']) });
		await expect(nativeGoogleLogin(createMockPrisma(), config, input, fetchFn)).resolves.toEqual(native);
		expect(call(fetchFn)).toMatchObject({ body: { auth_code: 'c', code_verifier: input.code_verifier }, url: 'https://proj.supabase.co/auth/v1/token?grant_type=pkce' });
	});

	it('answers invalid_or_expired_code when the exchange fails', async () => {
		await rejectsWith(nativeGoogleLogin(createMockPrisma(), config, input, gotrue({ status: 400 })), 'invalid_or_expired_code', 400);
	});

	it('answers provider_conflict when the email also has a password', async () => {
		await rejectsWith(nativeGoogleLogin(createMockPrisma(), config, input, gotrue({ body: session(['google', 'email']) }, { status: 204 })), 'provider_conflict', 409);
	});
});

describe('nativeForgotPassword', () => {
	it('asks Supabase to email a recovery code and never fails', async () => {
		const fetchFn = gotrue({ status: 200 });
		await nativeForgotPassword(config, 'a@b.co', fetchFn);
		expect(call(fetchFn)).toMatchObject({ body: { email: 'a@b.co' }, url: 'https://proj.supabase.co/auth/v1/recover' });
		const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		await expect(nativeForgotPassword(config, 'a@b.co', gotrue({ status: 429 }))).resolves.toBeUndefined();
		log.mockRestore();
	});
});

describe('nativeResetPassword', () => {
	const input = { email: 'a@b.co', password: 'newpassword', token: '123456' };

	it('verifies the code, sets the password, signs other sessions out and returns this session', async () => {
		const fetchFn = gotrue({ body: session() }, { body: {} }, { status: 204 });
		await expect(nativeResetPassword(createMockPrisma(), config, input, fetchFn)).resolves.toEqual(native);
		expect(call(fetchFn, 0).body).toEqual({ email: 'a@b.co', token: '123456', type: 'recovery' });
		expect(call(fetchFn, 1)).toMatchObject({ body: { password: 'newpassword' }, headers: { Authorization: 'Bearer at' }, method: 'PUT', url: 'https://proj.supabase.co/auth/v1/user' });
		expect(call(fetchFn, 2).url).toBe('https://proj.supabase.co/auth/v1/logout?scope=others');
	});

	it('answers invalid_or_expired_code for a wrong code', async () => {
		await rejectsWith(nativeResetPassword(createMockPrisma(), config, input, gotrue({ status: 403 })), 'invalid_or_expired_code', 400);
	});

	it('never gives a password to a Google account', async () => {
		const fetchFn = gotrue({ body: session(['google']) }, { status: 204 });
		await rejectsWith(nativeResetPassword(createMockPrisma(), config, input, fetchFn), 'invalid_or_expired_code', 400);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(call(fetchFn, 1).url).toBe('https://proj.supabase.co/auth/v1/logout?scope=local');
	});

	it('answers weak_password when Supabase rejects the new password', async () => {
		await rejectsWith(
			nativeResetPassword(createMockPrisma(), config, input, gotrue({ body: session() }, { body: { error_code: 'weak_password' }, status: 422 }, { status: 204 })),
			'weak_password',
			422
		);
	});
});
