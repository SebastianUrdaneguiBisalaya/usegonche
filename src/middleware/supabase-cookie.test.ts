import { supabaseMiddleware } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn(() => ({})) }));
// `@supabase/ssr` is a dependency of packages/auth, not of the API: it is mocked by the path that package resolves it to.
vi.mock('../../packages/auth/node_modules/@supabase/ssr', () => ({ createServerClient, parseCookieHeader: () => [] }));

const app = new Hono().use(supabaseMiddleware()).get('/ping', c => c.text('ok'));
const options = () => (createServerClient.mock.calls.at(-1) as unknown as [string, string, { cookieOptions?: { domain: string } }])[2];

beforeEach(() => {
	process.env.SUPABASE_URL = 'https://x.supabase.co';
	process.env.SUPABASE_PUBLISHABLE_KEY = 'key';
	createServerClient.mockClear();
});
afterEach(() => {
	delete process.env.COOKIE_DOMAIN;
});

describe('supabaseMiddleware cookie domain', () => {
	it('shares the session cookie across subdomains when COOKIE_DOMAIN is set', async () => {
		process.env.COOKIE_DOMAIN = '.example.com';
		await app.request('/ping');
		expect(options().cookieOptions).toEqual({ domain: '.example.com' });
	});

	it('keeps host-only cookies when COOKIE_DOMAIN is unset', async () => {
		await app.request('/ping');
		expect(options().cookieOptions).toBeUndefined();
	});
});
