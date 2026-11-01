import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env.js';
import { ok } from '../lib/http.js';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from './helpers.js';

const router = new Hono<AppEnv>()
	.use(requireAuth())
	.get('/me', c => ok(c, { id: c.get('claims').sub }))
	.post('/echo', async c => ok(c, await c.req.json(), 201));

describe('createTestApp', () => {
	it('runs the real requireAuth with the default user', async () => {
		const res = await createTestApp(router).request('/me');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { id: TEST_USER_ID } });
	});

	it('answers 401 in the error envelope when unauthenticated', async () => {
		const res = await createTestApp(router, { claims: null }).request('/me');
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});

	it('mounts the router under a path and sends JSON bodies', async () => {
		const res = await createTestApp(router, { path: '/x' }).request('/x/echo', jsonRequest('POST', { a: 1 }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: { a: 1 } });
	});

	it('answers 404 in the error envelope for unknown routes', async () => {
		const res = await createTestApp(router).request('/nope');
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
	});
});

describe('createMockPrisma', () => {
	it('creates stable lazy mocks per model operation', async () => {
		const prisma = createMockPrisma();
		expect(prisma.profile.findUnique).toBe(prisma.profile.findUnique);
		const { vi } = await import('vitest');
		vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
		expect(await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })).toBeNull();
	});

	it('runs interactive transactions with the same client', async () => {
		const prisma = createMockPrisma();
		expect(await prisma.$transaction(async tx => tx)).toBe(prisma);
	});
});
