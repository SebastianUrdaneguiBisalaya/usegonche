import type { SupabaseClient } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../env.js';
import { onError, onNotFound } from '../../middleware/error.js';
import { createMockPrisma, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './auth.routes.js';

const setup = (user: { email: string; id: string; identities: { provider: string }[] } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.profile.upsert).mockResolvedValue({} as never);
	const supabase = {
		auth: {
			signInWithIdToken: vi.fn(async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('bad') })),
			signOut: vi.fn(async () => ({ error: null })),
		},
	} as unknown as SupabaseClient;
	const app = new Hono<AppEnv>()
		.use(async (c, next) => {
			c.set('prisma', prisma);
			c.set('supabase', supabase);
			await next();
		})
		.route('/auth', routes)
		.onError(onError)
		.notFound(onNotFound);
	return { app, prisma, supabase };
};

const googleAnswers = (ok: boolean, body: unknown = { id_token: 'tok' }) =>
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ json: async () => body, ok }) as Response)
	);
const post = (app: ReturnType<typeof setup>['app'], body: unknown) => app.request('/auth/google', jsonRequest('POST', body));

beforeEach(() => {
	vi.stubEnv('GOOGLE_CLIENT_ID', 'web-id');
	vi.stubEnv('GOOGLE_CLIENT_SECRET', 'web-secret');
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe('POST /auth/google', () => {
	const user = { email: 'a@b.co', id: TEST_USER_ID, identities: [{ provider: 'google' }] };

	it('answers 422 validation_error with details for an invalid body', async () => {
		const { app } = setup(user);
		const res = await post(app, {});
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ field: 'code' }] } });
	});

	it('rejects unknown keys', async () => {
		const { app } = setup(user);
		expect((await post(app, { code: 'c', extra: 1 })).status).toBe(422);
	});

	it('signs in, syncs the profile and answers the public user', async () => {
		googleAnswers(true);
		const { app, prisma, supabase } = setup(user);
		const res = await post(app, { code: 'c' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { user: { email: 'a@b.co', id: TEST_USER_ID } } });
		expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'tok' });
		expect(prisma.profile.upsert).toHaveBeenCalled();
	});

	it('answers 400 invalid_or_expired_code when Google rejects the code', async () => {
		googleAnswers(false);
		const { app } = setup(user);
		const res = await post(app, { code: 'c' });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: { code: 'invalid_or_expired_code' } });
	});

	it('answers 400 oauth_failed when Supabase refuses the token', async () => {
		googleAnswers(true);
		const { app } = setup(null);
		const res = await post(app, { code: 'c' });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: { code: 'oauth_failed' } });
	});

	it('answers 409 provider_conflict and drops the session when the email also has a password', async () => {
		googleAnswers(true);
		const { app, supabase } = setup({ ...user, identities: [{ provider: 'google' }, { provider: 'email' }] });
		const res = await post(app, { code: 'c' });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: { code: 'provider_conflict' } });
		expect(supabase.auth.signOut).toHaveBeenCalled();
	});
});
