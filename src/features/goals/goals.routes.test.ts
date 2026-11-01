import type { Goal } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './goals.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const goal = { createdAt: new Date('2026-11-01T10:00:00.000Z'), id: ID, ownerId: TEST_USER_ID, status: 'active', title: 'Ship v1' } as Goal;
const json = (g: Goal) => JSON.parse(JSON.stringify(g));

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	return { app: createTestApp(routes, { claims, path: '/goals', prisma }), prisma };
};

describe.each([
	['GET', '/goals', undefined],
	['POST', '/goals', jsonRequest('POST', { title: 'x' })],
	['GET', `/goals/${ID}`, undefined],
	['PATCH', `/goals/${ID}`, jsonRequest('PATCH', { title: 'x' })],
	['POST', `/goals/${ID}/archive`, { method: 'POST' }],
	['POST', `/goals/${ID}/unarchive`, { method: 'POST' }],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /goals', () => {
	it('lists non-archived goals of the user with meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([goal]);

		const res = await app.request('/goals');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [json(goal)], meta: { limit: 50, nextCursor: null } });
		expect(prisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51, where: { archivedAt: null, ownerId: TEST_USER_ID } }));
	});

	it('applies archived and status filters', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
		await app.request('/goals?archived=true&status=achieved&limit=5');
		expect(prisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6, where: { archivedAt: { not: null }, ownerId: TEST_USER_ID, status: 'achieved' } }));
	});

	it('answers 422 for an invalid filter or cursor', async () => {
		const { app } = setup();
		expect((await app.request('/goals?status=nope')).status).toBe(422);
		expect((await app.request('/goals?cursor=garbage')).status).toBe(422);
	});
});

describe('POST /goals', () => {
	it('creates a goal for the claims user (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.create).mockResolvedValue(goal);

		const res = await app.request('/goals', jsonRequest('POST', { description: '{"type":"doc"}', targetDate: '2026-12-31', title: '  Ship v1  ' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: json(goal) });
		expect(prisma.goal.create).toHaveBeenCalledWith({ data: { description: '{"type":"doc"}', ownerId: TEST_USER_ID, targetDate: new Date('2026-12-31'), title: 'Ship v1' } });
	});

	it.each([
		['empty title', { title: ' ' }],
		['unknown key', { ownerId: 'x', title: 'a' }],
		['bad date', { targetDate: '31/12/2026', title: 'a' }],
		['non-JSON description', { description: '<p>x</p>', title: 'a' }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = setup();
		const res = await app.request('/goals', jsonRequest('POST', body));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
		expect(prisma.goal.create).not.toHaveBeenCalled();
	});
});

describe('GET /goals/:id', () => {
	it('returns the goal', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);
		const res = await app.request(`/goals/${ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: json(goal) });
	});

	it('answers 404 when not found and 422 for a bad id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);
		expect((await app.request(`/goals/${ID}`)).status).toBe(404);
		expect((await app.request('/goals/nope')).status).toBe(422);
	});
});

describe('PATCH /goals/:id', () => {
	it('updates the goal', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		const res = await app.request(`/goals/${ID}`, jsonRequest('PATCH', { status: 'achieved', targetDate: null }));
		expect(res.status).toBe(200);
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { status: 'achieved', targetDate: null }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/goals/${ID}`, jsonRequest('PATCH', { title: 'x' }))).status).toBe(404);
	});

	it.each([
		['empty body', {}],
		['bad status', { status: 'nope' }],
		['unknown key', { archivedAt: null }],
	])('answers 422 for %s', async (_name, body) => {
		const { app } = setup();
		expect((await app.request(`/goals/${ID}`, jsonRequest('PATCH', body))).status).toBe(422);
	});
});

describe('POST /goals/:id/archive and /unarchive', () => {
	it('archives and unarchives', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect((await app.request(`/goals/${ID}/archive`, { method: 'POST' })).status).toBe(200);
		expect((await app.request(`/goals/${ID}/unarchive`, { method: 'POST' })).status).toBe(200);
		expect(prisma.goal.updateMany).toHaveBeenCalledTimes(2);
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);
		expect((await app.request(`/goals/${ID}/archive`, { method: 'POST' })).status).toBe(404);
	});
});
