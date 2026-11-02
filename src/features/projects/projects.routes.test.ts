import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './projects.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const GOAL_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const TAG_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const row = { createdAt: new Date('2026-11-01T10:00:00.000Z'), id: ID, ownerId: TEST_USER_ID, tags: [], title: 'Launch' };
const body = JSON.parse(JSON.stringify(row));

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	return { app: createTestApp(routes, { claims, path: '/projects', prisma }), prisma };
};

describe.each([
	['GET', '/projects', undefined],
	['POST', '/projects', jsonRequest('POST', { title: 'x' })],
	['GET', `/projects/${ID}`, undefined],
	['PATCH', `/projects/${ID}`, jsonRequest('PATCH', { title: 'x' })],
	['POST', `/projects/${ID}/archive`, { method: 'POST' }],
	['POST', `/projects/${ID}/unarchive`, { method: 'POST' }],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /projects', () => {
	it('lists non-archived projects of the user with meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findMany).mockResolvedValue(asRow([row]));

		const res = await app.request('/projects');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [body], meta: { limit: 50, nextCursor: null } });
		expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51, where: { archivedAt: null, ownerId: TEST_USER_ID } }));
	});

	it('filters by goal, status and archived', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findMany).mockResolvedValue([]);
		await app.request(`/projects?goalId=${GOAL_ID}&status=on_hold&archived=true`);
		expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: { not: null }, goalId: GOAL_ID, ownerId: TEST_USER_ID, status: 'on_hold' } }));
	});

	it.each(['goalId=nope', 'status=nope', 'archived=maybe', 'cursor=garbage'])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/projects?${query}`)).status).toBe(422);
	});
});

describe('POST /projects', () => {
	it('creates a project for the claims user (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));

		const res = await app.request('/projects', jsonRequest('POST', { title: '  Launch  ' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: body });
		expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: TEST_USER_ID, tags: { create: [] }, title: 'Launch' }) }));
	});

	it('dedupes tag ids', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.count).mockResolvedValue(1);
		vi.mocked(prisma.project.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));
		await app.request('/projects', jsonRequest('POST', { tagIds: [TAG_ID, TAG_ID], title: 'a' }));
		expect(prisma.tag.count).toHaveBeenCalledWith({ where: { id: { in: [TAG_ID] }, ownerId: TEST_USER_ID } });
	});

	it('answers 422 with details when the goal is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);
		const res = await app.request('/projects', jsonRequest('POST', { goalId: GOAL_ID, title: 'a' }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ code: 'not_found', field: 'goalId' }] } });
	});

	it('answers 409 when the origin inbox item is not pending', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(asRow({ id: GOAL_ID }));
		const res = await app.request('/projects', jsonRequest('POST', { originInboxItemId: GOAL_ID, title: 'a' }));
		expect(res.status).toBe(409);
	});

	it.each([
		['empty title', { title: '' }],
		['unknown key', { ownerId: 'x', title: 'a' }],
		['bad goal id', { goalId: 'nope', title: 'a' }],
		['bad tag id', { tagIds: ['nope'], title: 'a' }],
		['oversized description', { description: 'x'.repeat(100_001), title: 'a' }],
	])('answers 422 for %s', async (_name, payload) => {
		const { app, prisma } = setup();
		const res = await app.request('/projects', jsonRequest('POST', payload));
		expect(res.status).toBe(422);
		expect(prisma.project.create).not.toHaveBeenCalled();
	});
});

describe('GET /projects/:id', () => {
	it('returns the project', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/projects/${ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: body });
	});

	it('answers 404 when not found and 422 for a bad id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		expect((await app.request(`/projects/${ID}`)).status).toBe(404);
		expect((await app.request('/projects/nope')).status).toBe(422);
	});
});

describe('PATCH /projects/:id', () => {
	it('updates the project', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow({ ...row, goalId: GOAL_ID, status: 'active' }));
		const res = await app.request(`/projects/${ID}`, jsonRequest('PATCH', { goalId: null, status: 'completed' }));
		expect(res.status).toBe(200);
		expect(prisma.project.updateMany).toHaveBeenCalledWith({ data: { goalId: null, status: 'completed' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('answers 200 with the project and writes nothing when nothing changes', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/projects/${ID}`, jsonRequest('PATCH', { title: 'Launch' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: body });
		expect(prisma.project.updateMany).not.toHaveBeenCalled();
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		expect((await app.request(`/projects/${ID}`, jsonRequest('PATCH', { title: 'x' }))).status).toBe(404);
	});

	it.each([
		['empty body', {}],
		['bad status', { status: 'nope' }],
		['unknown key', { archivedAt: null }],
	])('answers 422 for %s', async (_name, payload) => {
		expect((await setup().app.request(`/projects/${ID}`, jsonRequest('PATCH', payload))).status).toBe(422);
	});
});

describe('POST /projects/:id/archive and /unarchive', () => {
	it('archives and unarchives', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));
		expect((await app.request(`/projects/${ID}/archive`, { method: 'POST' })).status).toBe(200);
		expect((await app.request(`/projects/${ID}/unarchive`, { method: 'POST' })).status).toBe(200);
		expect(prisma.project.updateMany).toHaveBeenCalledTimes(2);
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		expect((await app.request(`/projects/${ID}/archive`, { method: 'POST' })).status).toBe(404);
	});
});
