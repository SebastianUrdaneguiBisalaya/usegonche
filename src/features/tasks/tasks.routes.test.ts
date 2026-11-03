import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './tasks.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const OTHER = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const BLOCKER = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const row = { blockers: [], createdAt: new Date('2026-11-01T10:00:00.000Z'), dependencies: [], dependents: [], id: ID, ownerId: TEST_USER_ID, status: 'todo', subtasks: [], tags: [], title: 'Write' };
const view = { ...JSON.parse(JSON.stringify(row)), blocked: false, blocksIds: [], dependsOnIds: [], openBlockers: 0, progress: { done: 0, total: 0 }, tags: [] };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const del = { method: 'DELETE' };
const post = { method: 'POST' };

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	return { app: createTestApp(routes, { claims, path: '/tasks', prisma }), prisma };
};

const expectedView = () => {
	const { blockers, dependencies, dependents, subtasks, ...rest } = view;
	void blockers;
	void dependents;
	void dependencies;
	void subtasks;
	return rest;
};

describe.each([
	['GET', '/tasks', undefined],
	['POST', '/tasks', jsonRequest('POST', { title: 'x' })],
	['PATCH', '/tasks/bulk', jsonRequest('PATCH', { changes: { priority: 'high' }, ids: [ID] })],
	['GET', `/tasks/${ID}`, undefined],
	['PATCH', `/tasks/${ID}`, jsonRequest('PATCH', { title: 'x' })],
	['DELETE', `/tasks/${ID}`, del],
	['POST', `/tasks/${ID}/dependencies`, jsonRequest('POST', { dependsOnId: OTHER })],
	['DELETE', `/tasks/${ID}/dependencies/${OTHER}`, del],
	['GET', `/tasks/${ID}/blockers`, undefined],
	['POST', `/tasks/${ID}/blockers`, jsonRequest('POST', { reason: 'x' })],
	['POST', `/tasks/${ID}/blockers/${BLOCKER}/resolve`, post],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /tasks', () => {
	it('lists top-level tasks of the user with meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([row]));
		vi.mocked(prisma.task.count).mockResolvedValue(1);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([{ _count: { _all: 1 }, status: 'todo' }] as never);
		const res = await app.request('/tasks');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			data: [expectedView()],
			meta: { counts: { blocked: 1, cancelled: 0, done: 0, in_progress: 0, overdue: 1, todo: 1 }, groups: null, page: 1, pageCount: 1, pageSize: 50, total: 1 },
		});
		expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50, where: { ownerId: TEST_USER_ID, parentId: null } }));
	});

	it('passes the filters to the service', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		await app.request(`/tasks?status=done&status=todo&priority=high&projectId=${OTHER}&dueBefore=2026-12-01&pageSize=5`);
		expect(prisma.task.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				skip: 0,
				take: 5,
				where: { dueDate: { lte: new Date('2026-12-01') }, ownerId: TEST_USER_ID, parentId: null, priority: 'high', projectId: OTHER, status: { in: ['done', 'todo'] } },
			})
		);
	});

	it('accepts one status, sort, order and blocked', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		const res = await app.request('/tasks?status=done&sort=title&order=asc&blocked=false');
		expect(res.status).toBe(200);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]).toMatchObject({ orderBy: [{ title: 'asc' }, { id: 'asc' }], where: { status: { in: ['done'] } } });
	});

	it('filters the occurrences of one recurrence rule, scoped to the owner', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		expect((await app.request(`/tasks?recurrenceId=${OTHER}&status=todo`)).status).toBe(200);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ ownerId: TEST_USER_ID, parentId: null, recurrenceId: OTHER, status: { in: ['todo'] } });
	});

	it('filters by a case-insensitive title match, scoped to the owner', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		expect((await app.request('/tasks?title=%20Roadmap%20')).status).toBe(200);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ ownerId: TEST_USER_ID, parentId: null, title: { contains: 'Roadmap', mode: 'insensitive' } });
	});

	it('accepts noProject and noDueDate', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		expect((await app.request('/tasks?noProject=true&noDueDate=true')).status).toBe(200);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ dueDate: null, ownerId: TEST_USER_ID, parentId: null, projectId: null });
	});

	it('groups the whole filtered set and answers the groups of the page in meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([row]));
		vi.mocked(prisma.task.groupBy).mockImplementation((async (args: { by: string[] }) => (args.by[0] === 'priority' ? [{ _count: { _all: 4 }, priority: 'high' }] : [])) as never);
		const res = await app.request('/tasks?groupBy=priority');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { meta: { groups: { count: number; key: string; taskIds: string[] }[]; total: number } };
		expect(body.meta.groups).toEqual([{ count: 4, key: 'high', taskIds: [row.id] }]);
		expect(body.meta.total).toBe(4);
	});

	it('accepts the working-set filter', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		expect((await app.request('/tasks?focus=true')).status).toBe(200);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ AND: [{ OR: expect.any(Array) }], ownerId: TEST_USER_ID });
	});

	it.each([
		'noProject=false',
		'noDueDate=1',
		'focus=1',
		'groupBy=nope',
		'focus=false',
		'status=nope',
		'sort=nope',
		'order=up',
		'blocked=maybe',
		'priority=nope',
		'projectId=nope',
		'recurrenceId=nope',
		'title=',
		'dueBefore=tomorrow',
		'page=0',
		'pageSize=0',
	])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/tasks?${query}`)).status).toBe(422);
	});
});

describe('PATCH /tasks/bulk', () => {
	it('updates the selected tasks for the claims user (200)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ dueDate: null, id: ID, startDate: null }]));
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(row));
		vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });
		const res = await app.request('/tasks/bulk', jsonRequest('PATCH', { changes: { priority: 'high' }, ids: [ID, ID] }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [expectedView()] });
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ id: { in: [ID] }, ownerId: TEST_USER_ID });
	});

	it('answers 404 when a task is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		const res = await app.request('/tasks/bulk', jsonRequest('PATCH', { changes: { status: 'done' }, ids: [ID] }));
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
	});

	it.each([
		['no ids', { changes: { priority: 'high' }, ids: [] }],
		['too many ids', { changes: { priority: 'high' }, ids: Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`) }],
		['no changes', { changes: {}, ids: [ID] }],
		['an unknown change', { changes: { title: 'x' }, ids: [ID] }],
		['shift mixed with a date', { changes: { dueDate: '2026-12-01', shiftDays: 2 }, ids: [ID] }],
		['a zero shift', { changes: { shiftDays: 0 }, ids: [ID] }],
		['due before start', { changes: { dueDate: '2026-11-01', startDate: '2026-12-01' }, ids: [ID] }],
	])('answers 422 for %s', async (_name, body) => {
		const res = await setup().app.request('/tasks/bulk', jsonRequest('PATCH', body));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
	});
});

describe('POST /tasks', () => {
	it('creates a task for the claims user (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request('/tasks', jsonRequest('POST', { dueDate: '2026-12-01', estimatedMinutes: 30, priority: 'high', startDate: '2026-11-01', title: '  Write  ' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: expectedView() });
		expect(prisma.task.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ estimatedMinutes: 30, origin: 'manual', ownerId: TEST_USER_ID, priority: 'high', status: 'todo', title: 'Write' }) })
		);
	});

	it('answers 422 with details when a reference is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		const res = await app.request('/tasks', jsonRequest('POST', { projectId: OTHER, title: 'a' }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ code: 'not_found', field: 'projectId' }] } });
	});

	it('answers 409 when the origin inbox item is not pending', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(asRow({ id: OTHER }));
		expect((await app.request('/tasks', jsonRequest('POST', { originInboxItemId: OTHER, title: 'a' }))).status).toBe(409);
	});

	it.each([
		['empty title', { title: '' }],
		['unknown key', { ownerId: 'x', title: 'a' }],
		['done on creation', { status: 'done', title: 'a' }],
		['bad priority', { priority: 'critical', title: 'a' }],
		['bad estimate', { estimatedMinutes: 0, title: 'a' }],
		['bad date', { dueDate: '01/12/2026', title: 'a' }],
		['due before start', { dueDate: '2026-11-01', startDate: '2026-12-01', title: 'a' }],
		['bad tag id', { tagIds: ['nope'], title: 'a' }],
		['oversized description', { description: 'x'.repeat(100_001), title: 'a' }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = setup();
		const res = await app.request('/tasks', jsonRequest('POST', body));
		expect(res.status).toBe(422);
		expect(prisma.task.create).not.toHaveBeenCalled();
	});
});

describe('GET /tasks/:id', () => {
	it('returns the task with derived fields', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/tasks/${ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: expectedView() });
	});

	it('answers 404 when not found and 422 for a bad id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect((await app.request(`/tasks/${ID}`)).status).toBe(404);
		expect((await app.request('/tasks/nope')).status).toBe(422);
	});
});

describe('PATCH /tasks/:id', () => {
	it('completes the task', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst)
			.mockResolvedValueOnce(asRow({ dueDate: null, startDate: null, status: 'todo', tags: [] }))
			.mockResolvedValue(asRow(row));
		vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });
		const res = await app.request(`/tasks/${ID}`, jsonRequest('PATCH', { status: 'done' }));
		expect(res.status).toBe(200);
		expect(prisma.task.updateMany).toHaveBeenCalledWith({ data: { completedAt: expect.any(Date), status: 'done' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect((await app.request(`/tasks/${ID}`, jsonRequest('PATCH', { title: 'x' }))).status).toBe(404);
	});

	it.each([
		['empty body', {}],
		['bad status', { status: 'nope' }],
		['unknown key', { completedAt: null }],
		['due before start', { dueDate: '2026-11-01', startDate: '2026-12-01' }],
	])('answers 422 for %s', async (_name, body) => {
		expect((await setup().app.request(`/tasks/${ID}`, jsonRequest('PATCH', body))).status).toBe(422);
	});
});

describe('PATCH /tasks/:id (no-op)', () => {
	it('answers 200 with the task and writes nothing when nothing changes', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ ...row, priority: 'high', tags: [] }));
		const res = await app.request(`/tasks/${ID}`, jsonRequest('PATCH', { priority: 'high', status: 'todo' }));
		expect(res.status).toBe(200);
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
		expect(prisma.taskEvent.createMany).not.toHaveBeenCalled();
	});
});

describe('DELETE /tasks/:id', () => {
	it('deletes and answers the id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.deleteMany).mockResolvedValue({ count: 1 });
		const res = await app.request(`/tasks/${ID}`, del);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { id: ID } });
		expect(prisma.task.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.deleteMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/tasks/${ID}`, del)).status).toBe(404);
	});
});

describe('dependencies', () => {
	it('adds a dependency', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(row));
		vi.mocked(prisma.taskDependency.findMany).mockResolvedValue([]);
		const res = await app.request(`/tasks/${ID}/dependencies`, jsonRequest('POST', { dependsOnId: OTHER }));
		expect(res.status).toBe(200);
		expect(prisma.taskDependency.createMany).toHaveBeenCalledWith({ data: [{ dependsOnId: OTHER, taskId: ID }], skipDuplicates: true });
	});

	it('answers 422 for a self dependency and 409 for a cycle', async () => {
		const { app, prisma } = setup();
		expect((await app.request(`/tasks/${ID}/dependencies`, jsonRequest('POST', { dependsOnId: ID }))).status).toBe(422);

		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(row));
		vi.mocked(prisma.taskDependency.findMany).mockResolvedValue(asRow([{ dependsOnId: ID }]));
		const res = await app.request(`/tasks/${ID}/dependencies`, jsonRequest('POST', { dependsOnId: OTHER }));
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: { code: 'dependency_cycle' } });
	});

	it('answers 422 for an invalid body', async () => {
		const { app } = setup();
		expect((await app.request(`/tasks/${ID}/dependencies`, jsonRequest('POST', { dependsOnId: 'nope' }))).status).toBe(422);
	});

	it('removes a dependency and answers 404 when it does not exist', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(row));
		vi.mocked(prisma.taskDependency.deleteMany).mockResolvedValue({ count: 1 });
		expect((await app.request(`/tasks/${ID}/dependencies/${OTHER}`, del)).status).toBe(200);

		vi.mocked(prisma.taskDependency.deleteMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/tasks/${ID}/dependencies/${OTHER}`, del)).status).toBe(404);
	});
});

describe('blockers', () => {
	const blocker = { id: BLOCKER, ownerId: TEST_USER_ID, reason: 'waiting', taskId: ID };

	it('lists blockers', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.taskBlocker.findMany).mockResolvedValue(asRow([blocker]));
		const res = await app.request(`/tasks/${ID}/blockers`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [blocker] });
	});

	it('creates a blocker for the claims user (201) and rejects an empty reason', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.taskBlocker.create).mockResolvedValue(asRow(blocker));
		const res = await app.request(`/tasks/${ID}/blockers`, jsonRequest('POST', { reason: '  waiting  ' }));
		expect(res.status).toBe(201);
		expect(prisma.taskBlocker.create).toHaveBeenCalledWith({ data: { ownerId: TEST_USER_ID, reason: 'waiting', taskId: ID } });
		expect((await app.request(`/tasks/${ID}/blockers`, jsonRequest('POST', { reason: ' ' }))).status).toBe(422);
	});

	it('answers 404 for a task that is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect((await app.request(`/tasks/${ID}/blockers`)).status).toBe(404);
	});

	it('resolves a blocker, 409 when already resolved, 404 when missing', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.taskBlocker.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.taskBlocker.findFirst).mockResolvedValue(asRow(blocker));
		expect((await app.request(`/tasks/${ID}/blockers/${BLOCKER}/resolve`, post)).status).toBe(200);

		vi.mocked(prisma.taskBlocker.updateMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/tasks/${ID}/blockers/${BLOCKER}/resolve`, post)).status).toBe(409);

		vi.mocked(prisma.taskBlocker.findFirst).mockResolvedValue(null);
		expect((await app.request(`/tasks/${ID}/blockers/${BLOCKER}/resolve`, post)).status).toBe(404);
	});
});
