import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './templates.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const row = { createdAt: new Date('2026-11-01T10:00:00.000Z'), description: null, id: ID, items: [], kind: 'task', name: 'Fix a bug', ownerId: TEST_USER_ID, tags: [], title: null };
const item = { priority: 'medium', title: 'Task' };
const taskBody = { item, kind: 'task', name: 'Fix a bug' };
const del = { method: 'DELETE' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.template.findFirst).mockResolvedValue(asRow(row));
	vi.mocked(prisma.template.create).mockResolvedValue(asRow({ id: ID }));
	vi.mocked(prisma.templateItem.create).mockResolvedValue(asRow({ id: 'i1' }));
	return { app: createTestApp(routes, { claims, path: '/templates', prisma }), prisma };
};

describe.each([
	['GET', '/templates', undefined],
	['POST', '/templates', jsonRequest('POST', taskBody)],
	['GET', `/templates/${ID}`, undefined],
	['PATCH', `/templates/${ID}`, jsonRequest('PATCH', { name: 'x' })],
	['DELETE', `/templates/${ID}`, del],
	['POST', `/templates/${ID}/instantiate`, jsonRequest('POST', {})],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /templates', () => {
	it('lists the templates of the user with meta and filters by kind', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.template.findMany).mockResolvedValue(asRow([row]));
		vi.mocked(prisma.template.count).mockResolvedValue(1);
		const res = await app.request('/templates?kind=task');
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: [{ id: ID }], meta: { page: 1, pageCount: 1, pageSize: 50, total: 1 } });
		expect(prisma.template.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { kind: 'task', ownerId: TEST_USER_ID } }));
	});

	it('answers 422 for an invalid kind or page', async () => {
		const { app } = setup();
		expect((await app.request('/templates?kind=nope')).status).toBe(422);
		expect((await app.request('/templates?page=0')).status).toBe(422);
	});
});

describe('POST /templates', () => {
	it('creates a task template for the user from the claims (201)', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/templates', jsonRequest('POST', taskBody));
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ data: { id: ID, name: 'Fix a bug' } });
		expect(vi.mocked(prisma.template.create).mock.calls[0]?.[0]?.data).toMatchObject({ ownerId: TEST_USER_ID });
	});

	it('creates a project template', async () => {
		const { app } = setup();
		const res = await app.request('/templates', jsonRequest('POST', { items: [item], kind: 'project', name: 'Launch', title: 'Launch project' }));
		expect(res.status).toBe(201);
	});

	it.each([
		['unknown keys (owner from the body)', { ...taskBody, ownerId: ID }],
		['a project template without title', { items: [item], kind: 'project', name: 'x' }],
		['a project template without tasks', { items: [], kind: 'project', name: 'x', title: 'x' }],
		['a task template without item', { kind: 'task', name: 'x' }],
		['an unknown kind', { ...taskBody, kind: 'nope' }],
		['a negative offset', { ...taskBody, item: { ...item, dueOffsetDays: -1 } }],
		['more than 20 subtasks', { ...taskBody, item: { ...item, subtasks: Array.from({ length: 21 }, () => item) } }],
		['too many items in total', { items: Array.from({ length: 11 }, () => ({ ...item, subtasks: Array.from({ length: 19 }, () => item) })), kind: 'project', name: 'x', title: 'x' }],
	])('answers 422 for %s', async (_name, body) => {
		expect((await setup().app.request('/templates', jsonRequest('POST', body))).status).toBe(422);
	});
});

describe('/templates/:id', () => {
	it('answers 404 when the template is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.template.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.template.deleteMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/templates/${ID}`)).status).toBe(404);
		expect((await app.request(`/templates/${ID}`, jsonRequest('PATCH', { name: 'x' }))).status).toBe(404);
		expect((await app.request(`/templates/${ID}`, del)).status).toBe(404);
		expect((await app.request(`/templates/${ID}/instantiate`, jsonRequest('POST', {}))).status).toBe(404);
	});

	it('answers 422 for an invalid id, an empty update and unknown keys', async () => {
		const { app } = setup();
		expect((await app.request('/templates/nope')).status).toBe(422);
		expect((await app.request(`/templates/${ID}`, jsonRequest('PATCH', {}))).status).toBe(422);
		expect((await app.request(`/templates/${ID}`, jsonRequest('PATCH', { kind: 'project' }))).status).toBe(422);
		expect((await app.request(`/templates/${ID}/instantiate`, jsonRequest('POST', { ownerId: ID }))).status).toBe(422);
	});

	it('gets, updates and deletes', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.template.deleteMany).mockResolvedValue({ count: 1 });
		expect((await app.request(`/templates/${ID}`)).status).toBe(200);
		expect((await app.request(`/templates/${ID}`, jsonRequest('PATCH', { name: 'New' }))).status).toBe(200);
		const deleted = await app.request(`/templates/${ID}`, del);
		expect(deleted.status).toBe(200);
		expect(await deleted.json()).toEqual({ data: { id: ID } });
	});

	it('instantiates (201) and answers 422 when the start date is missing', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.template.findFirst).mockResolvedValue(
			asRow({ ...row, items: [{ description: null, dueOffsetDays: 2, estimatedMinutes: null, id: 'i1', parentId: null, priority: 'medium', tags: [], title: 'Task' }] })
		);
		vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: 't1' }));
		const missing = await app.request(`/templates/${ID}/instantiate`, jsonRequest('POST', {}));
		expect(missing.status).toBe(422);
		expect(await missing.json()).toMatchObject({ error: { details: [{ code: 'start_date_required', field: 'startDate' }] } });
		const res = await app.request(`/templates/${ID}/instantiate`, jsonRequest('POST', { startDate: '2026-11-02' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: { projectId: null, taskIds: ['t1'] } });
	});
});
