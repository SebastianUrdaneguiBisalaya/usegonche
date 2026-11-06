import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../env.js';
import { onError, onNotFound } from '../../middleware/error.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { createMockPrisma, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './auth.routes.js';

const session = (providers = ['email']) => ({
	access_token: 'at',
	expires_at: 1_900_000_000,
	expires_in: 3600,
	refresh_token: 'rt',
	user: { email: 'a@b.co', id: TEST_USER_ID, identities: providers.map(provider => ({ provider })) },
});
const tokens = { accessToken: 'at', expiresAt: 1_900_000_000, refreshToken: 'rt', user: { email: 'a@b.co', id: TEST_USER_ID } };

/** Fake Supabase Auth REST API: answers each call with the next reply. */
const gotrue = (...replies: { body?: unknown; status?: number }[]) => {
	let i = 0;
	const fn = vi.fn(() => {
		const { body = {}, status = 200 } = replies[i++] ?? {};
		return Promise.resolve({ json: () => Promise.resolve(body), ok: status < 400, status } as Response);
	});
	vi.stubGlobal('fetch', fn);
	return fn;
};

const setup = ({ limited = false } = {}) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.profile.upsert).mockResolvedValue({} as never);
	const app = new Hono<AppEnv>()
		.use(async (c, next) => {
			c.set('prisma', prisma);
			await next();
		})
		.use('/auth/*', limited ? rateLimit('auth') : async (_c, next) => next())
		.route('/auth', routes)
		.onError(onError)
		.notFound(onNotFound);
	return { app, prisma };
};

const post = (app: ReturnType<typeof setup>['app'], path: string, body: unknown, headers: Record<string, string> = {}) => {
	const init = jsonRequest('POST', body);
	return app.request(`/auth/native${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), ...headers } });
};

/** Every native answer: no cookie, never cached. */
const expectNoCookieNoStore = (res: Response) => {
	expect(res.headers.get('set-cookie')).toBeNull();
	expect(res.headers.get('cache-control')).toBe('no-store');
};

beforeEach(() => {
	vi.stubEnv('SUPABASE_URL', 'https://proj.supabase.co');
	vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'pk');
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe('POST /auth/native/login', () => {
	it('answers the tokens in the body, without cookies and with no-store', async () => {
		gotrue({ body: session() });
		const { app, prisma } = setup();
		const res = await post(app, '/login', { email: 'A@b.co', password: 'pw' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: tokens });
		expectNoCookieNoStore(res);
		expect(prisma.profile.upsert).toHaveBeenCalled();
	});

	it('answers 401 invalid_credentials for a wrong password or an invalid body', async () => {
		gotrue({ body: { error_code: 'invalid_credentials' }, status: 400 });
		const { app } = setup();
		const wrong = await post(app, '/login', { email: 'a@b.co', password: 'nope' });
		expect(wrong.status).toBe(401);
		expect(await wrong.json()).toMatchObject({ error: { code: 'invalid_credentials' } });
		expectNoCookieNoStore(wrong);
		expect((await post(app, '/login', { email: 'a@b.co', extra: 1, password: 'x' })).status).toBe(401);
	});

	it('answers 403 email_not_confirmed', async () => {
		gotrue({ body: { error_code: 'email_not_confirmed' }, status: 400 });
		const res = await post(setup().app, '/login', { email: 'a@b.co', password: 'pw' });
		expect(res.status).toBe(403);
	});

	it('answers 429 after too many attempts', async () => {
		vi.stubEnv('RATE_LIMIT_DISABLED', 'false');
		vi.stubEnv('RATE_LIMIT_AUTH_PER_MINUTE', '2');
		gotrue({ status: 400 }, { status: 400 }, { status: 400 });
		const { app } = setup({ limited: true });
		await post(app, '/login', { email: 'a@b.co', password: 'x' });
		await post(app, '/login', { email: 'a@b.co', password: 'x' });
		const res = await post(app, '/login', { email: 'a@b.co', password: 'x' });
		expect(res.status).toBe(429);
		expect(await res.json()).toMatchObject({ error: { code: 'rate_limited' } });
	});
});

describe('POST /auth/native/signup', () => {
	const body = { displayName: 'Ana', email: 'a@b.co', password: 'password123' };

	it('answers 202 without cookies', async () => {
		gotrue({ body: {} });
		const res = await post(setup().app, '/signup', body);
		expect(res.status).toBe(202);
		expectNoCookieNoStore(res);
	});

	it('answers 422 for invalid fields and unknown keys', async () => {
		const { app } = setup();
		expect(await (await post(app, '/signup', { ...body, password: 'short' })).json()).toMatchObject({ error: { code: 'invalid_password' } });
		expect(await (await post(app, '/signup', { ...body, email: 'nope' })).json()).toMatchObject({ error: { code: 'invalid_email' } });
		expect(await (await post(app, '/signup', { ...body, displayName: ' ' })).json()).toMatchObject({ error: { details: [{ field: 'displayName' }] } });
		expect((await post(app, '/signup', { ...body, role: 'admin' })).status).toBe(422);
	});
});

describe('POST /auth/native/verify-email', () => {
	it('signs in with the code', async () => {
		gotrue({ body: session() });
		const res = await post(setup().app, '/verify-email', { email: 'a@b.co', token: '123456' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: tokens });
		expectNoCookieNoStore(res);
	});

	it('answers 422 with details for a malformed code', async () => {
		const res = await post(setup().app, '/verify-email', { email: 'a@b.co', token: 'abc' });
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ field: 'token' }] } });
	});
});

describe('POST /auth/native/refresh', () => {
	it('rotates the tokens', async () => {
		gotrue({ body: { ...session(), refresh_token: 'rt2' } });
		const res = await post(setup().app, '/refresh', { refreshToken: 'rt' });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: { refreshToken: 'rt2' } });
		expectNoCookieNoStore(res);
	});

	it('answers 401 for a reused or revoked refresh token', async () => {
		gotrue({ body: { error_code: 'refresh_token_already_used' }, status: 400 });
		const res = await post(setup().app, '/refresh', { refreshToken: 'rt' });
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
		expectNoCookieNoStore(res);
	});

	it('answers 422 for a missing or oversized token', async () => {
		const { app } = setup();
		expect((await post(app, '/refresh', {})).status).toBe(422);
		expect((await post(app, '/refresh', { refreshToken: 'x'.repeat(513) })).status).toBe(422);
	});
});

describe('POST /auth/native/logout', () => {
	it('revokes the session of the bearer token', async () => {
		const fetchFn = gotrue({ status: 204 });
		const res = await post(setup().app, '/logout', {}, { Authorization: 'Bearer at' });
		expect(res.status).toBe(200);
		expect(fetchFn).toHaveBeenCalledWith('https://proj.supabase.co/auth/v1/logout?scope=local', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer at' }) }));
		expectNoCookieNoStore(res);
	});

	it('answers 401 without a bearer token', async () => {
		const fetchFn = gotrue();
		const res = await post(setup().app, '/logout', {});
		expect(res.status).toBe(401);
		expect(fetchFn).not.toHaveBeenCalled();
	});
});

describe('/auth/native/google', () => {
	const challenge = 'A'.repeat(43);

	it('GET answers the authorize URL with the app-scheme redirect', async () => {
		const res = await setup().app.request(`/auth/native/google?code_challenge=${challenge}`);
		expect(res.status).toBe(200);
		const { data } = (await res.json()) as { data: { url: string } };
		const url = new URL(data.url);
		expect(url.searchParams.get('redirect_to')).toBe('usegonche://auth/callback');
		expect(url.searchParams.get('code_challenge')).toBe(challenge);
	});

	it('GET answers 422 for an invalid challenge or a client-chosen redirect', async () => {
		const { app } = setup();
		expect((await app.request('/auth/native/google?code_challenge=short')).status).toBe(422);
		expect((await app.request(`/auth/native/google?code_challenge=${challenge}&redirect_to=https://evil.example`)).status).toBe(422);
	});

	it('POST requires the verifier and signs in', async () => {
		gotrue({ body: session(['google']) });
		const { app } = setup();
		expect((await post(app, '/google', { code: 'c' })).status).toBe(422);
		const res = await post(app, '/google', { code: 'c', code_verifier: 'v'.repeat(43) });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: tokens });
		expectNoCookieNoStore(res);
	});

	it('POST answers 409 provider_conflict for a mixed account', async () => {
		gotrue({ body: session(['google', 'email']) }, { status: 204 });
		const res = await post(setup().app, '/google', { code: 'c', code_verifier: 'v'.repeat(43) });
		expect(res.status).toBe(409);
	});
});

describe('password recovery', () => {
	it('POST /forgot-password answers 202 even for invalid input', async () => {
		gotrue();
		const { app } = setup();
		expect((await post(app, '/forgot-password', { email: 'a@b.co' })).status).toBe(202);
		const invalid = await post(app, '/forgot-password', { email: 'nope' });
		expect(invalid.status).toBe(202);
		expectNoCookieNoStore(invalid);
	});

	it('POST /reset-password returns a session without cookies', async () => {
		gotrue({ body: session() }, { body: {} }, { status: 204 });
		const res = await post(setup().app, '/reset-password', { email: 'a@b.co', password: 'newpassword', token: '123456' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: tokens });
		expectNoCookieNoStore(res);
	});

	it('POST /reset-password answers 422 invalid_password / 400 invalid_or_expired_code for bad input', async () => {
		const { app } = setup();
		expect((await post(app, '/reset-password', { email: 'a@b.co', password: 'x', token: '123456' })).status).toBe(422);
		expect((await post(app, '/reset-password', { email: 'a@b.co', password: 'newpassword', token: 'x' })).status).toBe(400);
	});
});
