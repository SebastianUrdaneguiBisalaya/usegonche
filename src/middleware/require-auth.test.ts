import { describe, expect, it, vi } from 'vitest';
import tags from '../features/tags/tags.routes.js';
import { createMockPrisma, createTestApp } from '../test/helpers.js';

describe('requireAuth email confirmation', () => {
	it('answers 403 email_not_confirmed when the email is not confirmed', async () => {
		const app = createTestApp(tags, { emailConfirmed: false, path: '/tags', prisma: createMockPrisma() });
		const res = await app.request('/tags');
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: { code: 'email_not_confirmed' } });
	});

	it('lets confirmed users through', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
		const app = createTestApp(tags, { path: '/tags', prisma });
		const res = await app.request('/tags');
		expect(res.status).toBe(200);
	});
});

describe('requireAuth with a bearer token (native clients)', () => {
	it('verifies the Authorization bearer token instead of cookies', async () => {
		const { requireAuth } = await import('@usegonche/auth/hono');
		const { Hono } = await import('hono');
		const getClaims = vi.fn((_token?: string) => Promise.resolve({ data: { claims: { sub: 'u1' } }, error: null }));
		const getUser = vi.fn((_token?: string) => Promise.resolve({ data: { user: { email_confirmed_at: '2026-01-01T00:00:00Z', id: 'u1' } }, error: null }));
		const app = new Hono()
			.use(async (c, next) => {
				c.set('supabase', { auth: { getClaims, getUser } } as never);
				await next();
			})
			.get('/me', requireAuth(), c => c.json({ sub: c.get('claims').sub }));
		const res = await app.request('/me', { headers: { Authorization: 'Bearer access-token' } });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ sub: 'u1' });
		expect(getClaims).toHaveBeenCalledWith('access-token');
		expect(getUser).toHaveBeenCalledWith('access-token');
	});
});
