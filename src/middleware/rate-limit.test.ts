import type { Claims } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../env.js';
import { createMockPrisma, createTestApp, OTHER_USER_ID, TEST_USER_ID } from '../test/helpers.js';
import { requireUser } from './auth.js';
import { onError } from './error.js';
import { clientIp, rateLimit } from './rate-limit.js';

const socket = (address: string) => ({ incoming: { socket: { remoteAddress: address } } });

/** A tiny app with one rate-limited route; `claims` simulates what `requireAuth` would have set. */
const build = (scope: 'auth' | 'ip' | 'user', claims?: (c: { req: { header: (name: string) => string | undefined } }) => Claims | undefined) =>
	new Hono<AppEnv>()
		.use(async (c, next) => {
			const verified = claims?.(c);
			if (verified) c.set('claims', verified);
			await next();
		})
		.use(rateLimit(scope))
		.get('/ping', c => c.json({ ok: true }))
		.onError(onError);

const hit = (app: ReturnType<typeof build>, address = '1.1.1.1', headers: Record<string, string> = {}) => app.request('/ping', { headers }, socket(address));

const ENV_KEYS = ['RATE_LIMIT_DISABLED', 'RATE_LIMIT_IP_PER_MINUTE', 'RATE_LIMIT_USER_PER_MINUTE', 'RATE_LIMIT_AUTH_PER_MINUTE', 'TRUST_PROXY'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
	for (const key of ENV_KEYS) saved[key] = process.env[key];
	process.env.RATE_LIMIT_DISABLED = 'false';
	for (const key of ['RATE_LIMIT_IP_PER_MINUTE', 'RATE_LIMIT_USER_PER_MINUTE', 'RATE_LIMIT_AUTH_PER_MINUTE', 'TRUST_PROXY'] as const) delete process.env[key];
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	vi.useRealTimers();
});

describe('limits', () => {
	it('lets requests through under the limit, with rate limit headers', async () => {
		process.env.RATE_LIMIT_IP_PER_MINUTE = '3';
		const res = await hit(build('ip'));
		expect(res.status).toBe(200);
		expect(res.headers.get('RateLimit-Limit')).toBe('3');
		expect(res.headers.get('RateLimit-Remaining')).toBe('2');
	});

	it('answers 429 with the error envelope and Retry-After once the limit is exceeded', async () => {
		process.env.RATE_LIMIT_IP_PER_MINUTE = '2';
		const app = build('ip');
		expect((await hit(app)).status).toBe(200);
		expect((await hit(app)).status).toBe(200);
		const res = await hit(app);
		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({ error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' } });
		expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
	});

	it('uses the defaults per scope when the env is missing or invalid', async () => {
		const res = await hit(build('auth'));
		expect(res.headers.get('RateLimit-Limit')).toBe('10');
		process.env.RATE_LIMIT_USER_PER_MINUTE = 'abc';
		expect((await hit(build('user'))).headers.get('RateLimit-Limit')).toBe('120');
		expect((await hit(build('ip'))).headers.get('RateLimit-Limit')).toBe('300');
	});

	it('the auth scope is stricter than the others by default', async () => {
		const app = build('auth');
		for (let i = 0; i < 10; i += 1) expect((await hit(app)).status).toBe(200);
		expect((await hit(app)).status).toBe(429);
	});

	it('resets the counter when the window passes', async () => {
		vi.useFakeTimers();
		process.env.RATE_LIMIT_IP_PER_MINUTE = '1';
		const app = build('ip');
		expect((await hit(app)).status).toBe(200);
		expect((await hit(app)).status).toBe(429);
		vi.advanceTimersByTime(61_000);
		expect((await hit(app)).status).toBe(200);
	});

	it('does nothing when disabled', async () => {
		process.env.RATE_LIMIT_DISABLED = 'true';
		process.env.RATE_LIMIT_IP_PER_MINUTE = '1';
		const app = build('ip');
		for (let i = 0; i < 3; i += 1) expect((await hit(app)).status).toBe(200);
	});
});

describe('keys', () => {
	it('counts each IP separately', async () => {
		process.env.RATE_LIMIT_IP_PER_MINUTE = '1';
		const app = build('ip');
		expect((await hit(app, '1.1.1.1')).status).toBe(200);
		expect((await hit(app, '1.1.1.1')).status).toBe(429);
		expect((await hit(app, '2.2.2.2')).status).toBe(200);
	});

	it('keys the user scope by the verified user id, across IPs, and separates users', async () => {
		process.env.RATE_LIMIT_USER_PER_MINUTE = '1';
		const app = build('user', c => ({ sub: c.req.header('x-user') ?? TEST_USER_ID }));
		expect((await hit(app, '1.1.1.1')).status).toBe(200);
		expect((await hit(app, '9.9.9.9')).status).toBe(429);
		expect((await hit(app, '1.1.1.1', { 'x-user': OTHER_USER_ID })).status).toBe(200);
	});

	it('falls back to the IP when there are no claims', async () => {
		process.env.RATE_LIMIT_USER_PER_MINUTE = '1';
		const app = build('user');
		expect((await hit(app, '1.1.1.1')).status).toBe(200);
		expect((await hit(app, '1.1.1.1')).status).toBe(429);
		expect((await hit(app, '2.2.2.2')).status).toBe(200);
	});

	it('scopes do not share counters', async () => {
		process.env.RATE_LIMIT_IP_PER_MINUTE = '1';
		process.env.RATE_LIMIT_AUTH_PER_MINUTE = '1';
		expect((await hit(build('ip'))).status).toBe(200);
		expect((await hit(build('auth'))).status).toBe(200);
	});
});

describe('clientIp', () => {
	const ipOf = async (headers: Record<string, string>, bindings: object = socket('7.7.7.7')) => {
		let seen = '';
		const app = new Hono().get('/', c => {
			seen = clientIp(c);
			return c.text('ok');
		});
		await app.request('/', { headers }, bindings);
		return seen;
	};

	it('uses the socket address and ignores forgeable headers by default', async () => {
		expect(await ipOf({ 'cf-connecting-ip': '5.5.5.5', 'x-forwarded-for': '6.6.6.6' })).toBe('7.7.7.7');
	});

	it('uses the first X-Forwarded-For hop only when TRUST_PROXY is true', async () => {
		process.env.TRUST_PROXY = 'true';
		expect(await ipOf({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1' })).toBe('6.6.6.6');
		expect(await ipOf({})).toBe('7.7.7.7');
	});

	it('is "unknown" without a socket address', async () => {
		expect(await ipOf({}, {})).toBe('unknown');
	});
});

describe('Cloudflare binding', () => {
	const withBinding = (success: boolean) => {
		const limit = vi.fn(async (_options: { key: string }) => ({ success }));
		const app = build('user', () => ({ sub: TEST_USER_ID }));
		return { app, limit, request: () => app.request('/ping', {}, { RATE_LIMIT_USER: { limit } }) };
	};

	it('uses the binding instead of memory, keyed by scope and user', async () => {
		const { limit, request } = withBinding(true);
		expect((await request()).status).toBe(200);
		expect(limit).toHaveBeenCalledWith({ key: `user:${TEST_USER_ID}` });
	});

	it('answers 429 with the envelope and a Retry-After fallback when the binding refuses', async () => {
		const { request } = withBinding(false);
		const res = await request();
		expect(res.status).toBe(429);
		expect(await res.json()).toMatchObject({ error: { code: 'rate_limited' } });
		expect(res.headers.get('Retry-After')).toBe('60');
	});
});

describe('requireUser', () => {
	const setup = (claims?: { sub: string } | null) => {
		const prisma = createMockPrisma();
		const router = new Hono<AppEnv>().use(requireUser()).get('/ping', c => c.json({ sub: c.get('claims').sub }));
		return createTestApp(router, { claims, path: '/t', prisma });
	};

	it('answers 401 without authentication and does not spend the user quota', async () => {
		process.env.RATE_LIMIT_USER_PER_MINUTE = '1';
		const res = await setup(null).request('/t/ping');
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});

	it('limits an authenticated user by their id and answers 429', async () => {
		process.env.RATE_LIMIT_USER_PER_MINUTE = '2';
		const app = setup();
		expect((await app.request('/t/ping')).status).toBe(200);
		expect(await (await app.request('/t/ping')).json()).toEqual({ sub: TEST_USER_ID });
		const res = await app.request('/t/ping');
		expect(res.status).toBe(429);
		expect(await res.json()).toMatchObject({ error: { code: 'rate_limited' } });
	});
});
