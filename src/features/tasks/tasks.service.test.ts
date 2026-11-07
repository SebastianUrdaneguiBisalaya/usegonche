import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createMockStorage, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { bulkUpdateTasks, createTask, deleteTask, getTask, listTasks, updateTask } from './tasks.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const PARENT_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const TAG_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const INBOX_ID = 'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';
const REF_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const tag = { id: TAG_ID, name: 'work' };
const base = { blockers: [], dependencies: [], dependents: [], id: ID, ownerId: TEST_USER_ID, status: 'todo', subtasks: [], tags: [], title: 'Write' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);
const input = { priority: 'medium' as const, status: 'todo' as const, tagIds: [], title: 'Write' };

describe('getTask (derived fields)', () => {
	it('is not blocked when dependencies are done or cancelled', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ ...base, dependencies: [{ dependsOn: { id: REF_ID, status: 'done' } }, { dependsOn: { id: PARENT_ID, status: 'cancelled' } }] }));
		expect(await getTask(prisma, TEST_USER_ID, ID)).toMatchObject({ blocked: false, dependsOnIds: [REF_ID, PARENT_ID], openBlockers: 0 });
	});

	it('is blocked by an unfinished dependency', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ ...base, dependencies: [{ dependsOn: { id: REF_ID, status: 'in_progress' } }] }));
		expect(await getTask(prisma, TEST_USER_ID, ID)).toMatchObject({ blocked: true });
	});

	it('is blocked by an open manual blocker', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ ...base, blockers: [{ id: 'b' }] }));
		expect(await getTask(prisma, TEST_USER_ID, ID)).toMatchObject({ blocked: true, openBlockers: 1 });
	});

	it('lists the tasks that wait for it', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ ...base, dependents: [{ taskId: REF_ID }, { taskId: PARENT_ID }] }));
		expect(await getTask(prisma, TEST_USER_ID, ID)).toMatchObject({ blocksIds: [REF_ID, PARENT_ID] });
	});

	it('derives progress from subtasks ignoring cancelled ones and flattens tags', async () => {
		const prisma = createMockPrisma();
		const subtasks = [{ status: 'done' }, { status: 'todo' }, { status: 'cancelled' }];
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ ...base, subtasks, tags: [{ tag }] }));
		expect(await getTask(prisma, TEST_USER_ID, ID)).toMatchObject({ progress: { done: 1, total: 2 }, tags: [tag] });
	});

	it('throws 404 scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(getTask(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(vi.mocked(prisma.task.findFirst).mock.calls[0]?.[0]?.where).toEqual({ id: ID, ownerId: OTHER_USER_ID });
	});
});

describe('listTasks', () => {
	it('lists top-level tasks of the owner by default', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([base]));
		vi.mocked(prisma.task.count).mockResolvedValue(1);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		const page = await listTasks(prisma, TEST_USER_ID, {}, { page: 1, pageSize: 20 });
		expect(page.items).toHaveLength(1);
		expect(page.total).toBe(1);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
		expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20, where: { ownerId: TEST_USER_ID, parentId: null } }));
		expect(prisma.task.count).toHaveBeenCalledWith({ where: { ownerId: TEST_USER_ID, parentId: null } });
	});

	it('applies every filter', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		const dueAfter = new Date('2026-11-01');
		const dueBefore = new Date('2026-11-30');
		await listTasks(
			prisma,
			TEST_USER_ID,
			{ dueAfter, dueBefore, goalId: REF_ID, parentId: PARENT_ID, priority: 'high', projectId: REF_ID, recurrenceId: REF_ID, status: ['done', 'in_progress'], tagId: TAG_ID, title: 'road' },
			{ page: 1, pageSize: 10 }
		);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({
			dueDate: { gte: dueAfter, lte: dueBefore },
			goalId: REF_ID,
			ownerId: TEST_USER_ID,
			parentId: PARENT_ID,
			priority: 'high',
			projectId: REF_ID,
			recurrenceId: REF_ID,
			status: { in: ['done', 'in_progress'] },
			tags: { some: { tagId: TAG_ID } },
			title: { contains: 'road', mode: 'insensitive' },
		});
	});

	it('skips the previous pages keeping the owner scope', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		await listTasks(prisma, TEST_USER_ID, {}, { page: 3, pageSize: 10 });
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]).toMatchObject({ skip: 20, take: 10, where: { ownerId: TEST_USER_ID } });
	});

	it('counts per status (ignoring the status filter) plus blocked, overdue and the working set', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.count).mockResolvedValueOnce(0).mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(6);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([
			{ _count: { _all: 5 }, status: 'todo' },
			{ _count: { _all: 3 }, status: 'done' },
		] as never);
		const page = await listTasks(prisma, TEST_USER_ID, { status: ['done'] }, { page: 1, pageSize: 10 });
		expect(page.counts).toEqual({ blocked: 4, cancelled: 0, done: 3, focus: 6, in_progress: 0, overdue: 2, todo: 5 });
		expect(vi.mocked(prisma.task.groupBy).mock.calls[0]?.[0]).toMatchObject({ by: ['status'], where: { ownerId: TEST_USER_ID, parentId: null } });
		expect(vi.mocked(prisma.task.groupBy).mock.calls[0]?.[0]?.where).not.toHaveProperty('status');
	});

	it('lists the tasks with no project or no due date', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		await listTasks(prisma, TEST_USER_ID, { noDueDate: true, noProject: true }, { page: 1, pageSize: 10 });
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ dueDate: null, ownerId: TEST_USER_ID, parentId: null, projectId: null });
	});

	it('an explicit project or due range wins over noProject / noDueDate', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		await listTasks(prisma, TEST_USER_ID, { dueBefore: new Date('2026-11-30'), noDueDate: true, noProject: true, projectId: REF_ID }, { page: 1, pageSize: 10 });
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ dueDate: { lte: new Date('2026-11-30') }, ownerId: TEST_USER_ID, parentId: null, projectId: REF_ID });
	});

	it('keeps the working set: open tasks overdue, due within 7 days or undated, and tasks closed in the last 7 days', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-10T15:00:00Z'));
		try {
			const prisma = createMockPrisma();
			vi.mocked(prisma.task.findMany).mockResolvedValue([]);
			vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
			await listTasks(prisma, TEST_USER_ID, { focus: true, status: ['todo'] }, { page: 1, pageSize: 10 });
			const focus = {
				OR: [
					{ OR: [{ dueDate: null }, { dueDate: { lte: new Date('2026-11-16') } }], status: { in: ['todo', 'in_progress'] } },
					{ status: { in: ['done', 'cancelled'] }, updatedAt: { gte: new Date('2026-11-03T15:00:00Z') } },
				],
			};
			expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ AND: [focus], ownerId: TEST_USER_ID, parentId: null, status: { in: ['todo'] } });
			// The counters follow the working set too (every filter but the status).
			expect(vi.mocked(prisma.task.groupBy).mock.calls[0]?.[0]?.where).toEqual({ AND: [focus], ownerId: TEST_USER_ID, parentId: null });
		} finally {
			vi.useRealTimers();
		}
	});

	it('scopes the working set to the owner and combines it with the other filters', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		await listTasks(prisma, TEST_USER_ID, { blocked: true, focus: true, projectId: REF_ID }, { page: 1, pageSize: 10 });
		const where = vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where;
		expect(where).toMatchObject({ ownerId: TEST_USER_ID, projectId: REF_ID });
		expect(where?.AND).toHaveLength(1);
		expect(where).toHaveProperty('OR');
	});

	describe('grouped', () => {
		const where = { ownerId: TEST_USER_ID, parentId: null };
		const rowOf = (id: string) => asRow({ ...base, id });

		it('lays the groups of the whole filtered set end to end and slices the page over them', async () => {
			const prisma = createMockPrisma();
			vi.mocked(prisma.task.groupBy).mockImplementation((async (args: { by: string[] }) =>
				args.by[0] === 'priority'
					? [
							{ _count: { _all: 3 }, priority: 'low' },
							{ _count: { _all: 2 }, priority: 'urgent' },
						]
					: []) as never);
			vi.mocked(prisma.task.findMany).mockImplementation((async (args: { skip: number; take: number }) =>
				Array.from({ length: args.take }, (_, index) => rowOf(`t${args.skip + index}`))) as never);

			const first = await listTasks(prisma, TEST_USER_ID, { groupBy: 'priority' }, { page: 1, pageSize: 3 });
			expect(first.total).toBe(5);
			// Urgent first, then low: the page holds the two urgent tasks and the first low one.
			expect(first.groups).toEqual([
				{ count: 2, key: 'urgent', taskIds: ['t0', 't1'] },
				{ count: 3, key: 'low', taskIds: ['t0'] },
			]);
			expect(vi.mocked(prisma.task.findMany).mock.calls.map(([args]) => [args?.skip, args?.take, args?.where])).toEqual([
				[0, 2, { AND: [where, { priority: 'urgent' }] }],
				[0, 1, { AND: [where, { priority: 'low' }] }],
			]);

			vi.mocked(prisma.task.findMany).mockClear();
			const second = await listTasks(prisma, TEST_USER_ID, { groupBy: 'priority' }, { page: 2, pageSize: 3 });
			// The low group continues on the next page, still reporting its full size.
			expect(second.groups).toEqual([{ count: 3, key: 'low', taskIds: ['t1', 't2'] }]);
			expect(vi.mocked(prisma.task.findMany).mock.calls.map(([args]) => [args?.skip, args?.take])).toEqual([[1, 2]]);
		});

		it('orders projects by name with the tasks that have none last, looking them up by owner', async () => {
			const prisma = createMockPrisma();
			const [a, b] = ['a1a1a1a1-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002'];
			vi.mocked(prisma.task.groupBy).mockImplementation((async (args: { by: string[] }) =>
				args.by[0] === 'projectId'
					? [
							{ _count: { _all: 3 }, projectId: null },
							{ _count: { _all: 1 }, projectId: b },
							{ _count: { _all: 2 }, projectId: a },
						]
					: []) as never);
			vi.mocked(prisma.project.findMany).mockResolvedValue([
				{ id: a, title: 'Alpha' },
				{ id: b, title: 'Beta' },
			] as never);
			vi.mocked(prisma.task.findMany).mockResolvedValue([]);
			const page = await listTasks(prisma, TEST_USER_ID, { groupBy: 'project' }, { page: 1, pageSize: 10 });
			expect(page.groups?.map(group => [group.key, group.count])).toEqual([
				[a, 2],
				[b, 1],
				['none', 3],
			]);
			expect(prisma.project.findMany).toHaveBeenCalledWith({ select: { id: true, title: true }, where: { id: { in: [b, a] }, ownerId: TEST_USER_ID } });
			expect(vi.mocked(prisma.task.findMany).mock.calls.at(-1)?.[0]?.where).toEqual({ AND: [where, { projectId: null }] });
		});

		it('buckets by due date with the server day, leaving empty buckets out', async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-11-10T23:30:00Z'));
			try {
				const prisma = createMockPrisma();
				// Bucket counts come first, in display order: overdue, today, week, later, none.
				for (const count of [2, 0, 1, 0, 4]) vi.mocked(prisma.task.count).mockResolvedValueOnce(count);
				vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
				vi.mocked(prisma.task.findMany).mockResolvedValue([]);
				const page = await listTasks(prisma, TEST_USER_ID, { groupBy: 'due' }, { page: 1, pageSize: 10 });
				expect(page.groups?.map(group => [group.key, group.count])).toEqual([
					['overdue', 2],
					['week', 1],
					['none', 4],
				]);
				expect(page.total).toBe(7);
				const today = new Date('2026-11-10');
				expect(vi.mocked(prisma.task.findMany).mock.calls.map(([args]) => args?.where)).toEqual([
					{ AND: [where, { dueDate: { lt: today }, status: { in: ['todo', 'in_progress'] } }] },
					{ AND: [where, { dueDate: { gt: today, lte: new Date('2026-11-16') } }] },
					{ AND: [where, { dueDate: null }] },
				]);
			} finally {
				vi.useRealTimers();
			}
		});
	});

	it("counts overdue against the user's day in their stored time zone, not the UTC day (regression #138)", async () => {
		vi.useFakeTimers();
		// 02:30 UTC on the 10th is still the evening of the 9th in Lima (UTC-5).
		vi.setSystemTime(new Date('2026-11-10T02:30:00Z'));
		try {
			const prisma = createMockPrisma();
			vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ timezone: 'America/Lima' } as never);
			vi.mocked(prisma.task.findMany).mockResolvedValue([]);
			vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
			await listTasks(prisma, TEST_USER_ID, {}, { page: 1, pageSize: 10 });
			expect(prisma.userSettings.findUnique).toHaveBeenCalledWith({ select: { timezone: true }, where: { ownerId: TEST_USER_ID } });
			const overdue = vi
				.mocked(prisma.task.count)
				.mock.calls.map(([args]) => args?.where)
				.find(where => JSON.stringify(where).includes('"lt"'));
			expect(overdue).toEqual({
				AND: [
					{ ownerId: TEST_USER_ID, parentId: null },
					{ dueDate: { lt: new Date('2026-11-09') }, status: { in: ['todo', 'in_progress'] } },
				],
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it('falls back to UTC when the user never set a time zone', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-10T02:30:00Z'));
		try {
			const prisma = createMockPrisma();
			vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
			vi.mocked(prisma.task.findMany).mockResolvedValue([]);
			vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
			await listTasks(prisma, TEST_USER_ID, {}, { page: 1, pageSize: 10 });
			const overdue = vi
				.mocked(prisma.task.count)
				.mock.calls.map(([args]) => args?.where)
				.find(where => JSON.stringify(where).includes('"lt"'));
			expect(overdue).toMatchObject({ AND: [expect.anything(), { dueDate: { lt: new Date('2026-11-10') } }] });
		} finally {
			vi.useRealTimers();
		}
	});

	it('filters blocked and not blocked tasks', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		await listTasks(prisma, TEST_USER_ID, { blocked: true }, { page: 1, pageSize: 10 });
		await listTasks(prisma, TEST_USER_ID, { blocked: false }, { page: 1, pageSize: 10 });
		const [yes, no] = vi.mocked(prisma.task.findMany).mock.calls.map(call => call[0]?.where);
		expect(yes).toHaveProperty('OR');
		expect(no).toHaveProperty('NOT');
	});

	it('sorts with the id as tie-breaker and puts empty dates last', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
		await listTasks(prisma, TEST_USER_ID, { order: 'asc', sort: 'dueDate' }, { page: 1, pageSize: 10 });
		await listTasks(prisma, TEST_USER_ID, { order: 'asc', sort: 'priority' }, { page: 1, pageSize: 10 });
		const [byDue, byPriority] = vi.mocked(prisma.task.findMany).mock.calls.map(call => call[0]?.orderBy);
		expect(byDue).toEqual([{ dueDate: { nulls: 'last', sort: 'asc' } }, { id: 'asc' }]);
		expect(byPriority).toEqual([{ priority: 'asc' }, { id: 'asc' }]);
	});
});

describe('bulkUpdateTasks', () => {
	const A = ID;
	const B = PARENT_ID;
	const setupBulk = (tasks: { dueDate: Date | null; id: string; startDate: Date | null }[]) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow(tasks));
		vi.mocked(prisma.task.findFirst).mockImplementation(((args: { where: { id: string } }) =>
			Promise.resolve(asRow({ ...base, id: args.where.id, dueDate: null, startDate: null, tags: [] }))) as never);
		vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });
		return prisma;
	};

	it('applies the change to every task, scoped by owner, in the order of ids', async () => {
		const prisma = setupBulk([
			{ dueDate: null, id: A, startDate: null },
			{ dueDate: null, id: B, startDate: null },
		]);
		const result = await bulkUpdateTasks(prisma, TEST_USER_ID, { changes: { priority: 'high' }, ids: [B, A] });
		expect(result.map(task => task.id)).toEqual([B, A]);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({ id: { in: [B, A] }, ownerId: TEST_USER_ID });
		expect(vi.mocked(prisma.task.updateMany).mock.calls.map(call => call[0]?.where)).toEqual([
			{ id: B, ownerId: TEST_USER_ID },
			{ id: A, ownerId: TEST_USER_ID },
		]);
	});

	it('answers 404 and writes nothing when an id is not the owner’s', async () => {
		const prisma = setupBulk([{ dueDate: null, id: A, startDate: null }]);
		expect(await rejection(bulkUpdateTasks(prisma, OTHER_USER_ID, { changes: { status: 'done' }, ids: [A, B] }))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
	});

	it('moves the dates each task has with shiftDays', async () => {
		const prisma = setupBulk([
			{ dueDate: new Date('2026-11-10'), id: A, startDate: new Date('2026-11-05') },
			{ dueDate: null, id: B, startDate: null },
		]);
		vi.mocked(prisma.task.findFirst).mockImplementation(((args: { where: { id: string } }) =>
			Promise.resolve(
				asRow({ ...base, id: args.where.id, dueDate: args.where.id === A ? new Date('2026-11-10') : null, startDate: args.where.id === A ? new Date('2026-11-05') : null, tags: [] })
			)) as never);
		await bulkUpdateTasks(prisma, TEST_USER_ID, { changes: { shiftDays: 3 }, ids: [A, B] });
		expect(prisma.task.updateMany).toHaveBeenCalledTimes(1);
		expect(vi.mocked(prisma.task.updateMany).mock.calls[0]?.[0]?.data).toMatchObject({ dueDate: new Date('2026-11-13'), startDate: new Date('2026-11-08') });
	});
});

describe('createTask', () => {
	const setupCreate = () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(base));
		return prisma;
	};

	it('creates a manual task for the owner with tags', async () => {
		const prisma = setupCreate();
		vi.mocked(prisma.tag.count).mockResolvedValue(1);
		await createTask(prisma, TEST_USER_ID, { ...input, tagIds: [TAG_ID] });
		expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ origin: 'manual', ownerId: TEST_USER_ID, tags: { create: [{ tagId: TAG_ID }] } }) }));
	});

	it('converts an inbox item atomically and sets origin inbox', async () => {
		const prisma = setupCreate();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });
		await createTask(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID });
		expect(prisma.inboxItem.updateMany).toHaveBeenCalledWith({ data: { processedAt: expect.any(Date), status: 'converted' }, where: { id: INBOX_ID, ownerId: TEST_USER_ID, status: 'pending' } });
		expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ origin: 'inbox', originInboxItemId: INBOX_ID }) }));
	});

	it('fails with 404/409 and creates nothing when the inbox item cannot be converted', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(null);
		expect(await rejection(createTask(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID }))).toMatchObject({ status: 404 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(asRow({ id: INBOX_ID }));
		expect(await rejection(createTask(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID }))).toMatchObject({ status: 409 });
		expect(prisma.task.create).not.toHaveBeenCalled();
	});

	type Prisma = ReturnType<typeof createMockPrisma>;
	it.each([
		['projectId', (p: Prisma) => vi.mocked(p.project.findFirst).mockResolvedValue(null)],
		['goalId', (p: Prisma) => vi.mocked(p.goal.findFirst).mockResolvedValue(null)],
		['parentId', (p: Prisma) => vi.mocked(p.task.findFirst).mockResolvedValue(null)],
		['tagIds', (p: Prisma) => vi.mocked(p.tag.count).mockResolvedValue(0)],
	])('rejects a %s that is not the owner’s with 422', async (field, arrange) => {
		const prisma = createMockPrisma();
		arrange(prisma);
		const refs = { goalId: REF_ID, parentId: PARENT_ID, projectId: REF_ID, tagIds: [TAG_ID] };
		const body = { ...input, [field]: refs[field as keyof typeof refs] };
		expect(await rejection(createTask(prisma, TEST_USER_ID, body))).toMatchObject({ details: [{ code: 'not_found', field }], status: 422 });
		expect(prisma.task.create).not.toHaveBeenCalled();
	});

	it('rejects a parent that is itself a subtask (single level)', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: PARENT_ID, parentId: REF_ID }));
		expect(await rejection(createTask(prisma, TEST_USER_ID, { ...input, parentId: PARENT_ID }))).toMatchObject({ details: [{ code: 'nested_subtask', field: 'parentId' }] });
	});
});

describe('updateTask', () => {
	const current = (extra: object = {}) => ({ dueDate: null, priority: 'medium', projectId: null, startDate: null, status: 'todo', tags: [], ...extra });
	const setupUpdate = (existing: object) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValueOnce(asRow(existing)).mockResolvedValue(asRow(base));
		vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });
		return prisma;
	};
	const dataOf = (prisma: ReturnType<typeof createMockPrisma>) => vi.mocked(prisma.task.updateMany).mock.calls[0]?.[0]?.data;

	describe('recurring occurrences', () => {
		const RULE_ID = '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b';
		const occurrence = (extra: object = {}) => current({ occurrenceDate: new Date('2026-11-02T00:00:00Z'), recurrenceId: RULE_ID, ...extra });
		const withRule = (prisma: ReturnType<typeof createMockPrisma>) => {
			vi.mocked(prisma.recurrenceRule.findFirst).mockResolvedValue(
				asRow({ generatedUntil: null, id: RULE_ID, ownerId: TEST_USER_ID, rule: 'FREQ=WEEKLY;BYDAY=MO', startDate: new Date('2026-11-02T00:00:00Z'), tags: [] })
			);
			vi.mocked(prisma.task.findMany).mockResolvedValue([]);
			vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: 'task-1' }));
		};

		it.each(['done', 'cancelled'] as const)('creates the next occurrence when it moves to %s', async status => {
			const prisma = setupUpdate(occurrence());
			withRule(prisma);
			await updateTask(prisma, TEST_USER_ID, ID, { status });
			expect(vi.mocked(prisma.task.create).mock.calls[0]?.[0]?.data).toMatchObject({ occurrenceDate: new Date('2026-11-09T00:00:00Z'), recurrenceId: RULE_ID });
		});

		it('does nothing for other status changes or for plain tasks', async () => {
			const started = setupUpdate(occurrence());
			withRule(started);
			await updateTask(started, TEST_USER_ID, ID, { status: 'in_progress' });
			expect(started.task.create).not.toHaveBeenCalled();
			const plain = setupUpdate(current());
			withRule(plain);
			await updateTask(plain, TEST_USER_ID, ID, { status: 'done' });
			expect(plain.task.create).not.toHaveBeenCalled();
		});
	});

	it('sets completedAt when entering done', async () => {
		const prisma = setupUpdate(current());
		await updateTask(prisma, TEST_USER_ID, ID, { status: 'done' });
		expect(dataOf(prisma)).toEqual({ completedAt: expect.any(Date), status: 'done' });
		expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID, ownerId: TEST_USER_ID } }));
	});

	it('keeps the original completedAt when done is re-sent: nothing is written', async () => {
		const prisma = setupUpdate(current({ completedAt: new Date('2026-11-01'), status: 'done' }));
		await updateTask(prisma, TEST_USER_ID, ID, { status: 'done' });
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
		expect(prisma.taskEvent.createMany).not.toHaveBeenCalled();
	});

	it('is idempotent: sending the stored values (tags in any order) answers the task and writes nothing', async () => {
		const prisma = setupUpdate(current({ tags: [{ tagId: TAG_ID }, { tagId: PARENT_ID }], title: 'Write' }));
		expect(await updateTask(prisma, TEST_USER_ID, ID, { priority: 'medium', status: 'todo', tagIds: [PARENT_ID, TAG_ID], title: 'Write' })).toMatchObject({ id: ID });
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
		expect(prisma.taskEvent.createMany).not.toHaveBeenCalled();
		expect(prisma.taskTag.deleteMany).not.toHaveBeenCalled();
		expect(prisma.taskTag.createMany).not.toHaveBeenCalled();
	});

	it('writes only the changed fields', async () => {
		const prisma = setupUpdate(current({ title: 'Write' }));
		await updateTask(prisma, TEST_USER_ID, ID, { priority: 'medium', title: 'Rewrite' });
		expect(dataOf(prisma)).toEqual({ completedAt: undefined, title: 'Rewrite' });
	});

	it.each(['todo', 'in_progress', 'cancelled'] as const)('clears completedAt when a done task moves to %s', async status => {
		const prisma = setupUpdate(current({ status: 'done' }));
		await updateTask(prisma, TEST_USER_ID, ID, { status });
		expect(dataOf(prisma)).toEqual({ completedAt: null, status });
	});

	it('writes history events for tracked changes in the same transaction', async () => {
		const prisma = setupUpdate(current({ priority: 'medium', projectId: null }));
		const dueDate = new Date('2026-11-20');
		await updateTask(prisma, TEST_USER_ID, ID, { dueDate, priority: 'urgent', projectId: null, status: 'in_progress' });
		expect(prisma.taskEvent.createMany).toHaveBeenCalledWith({
			data: [
				{ fromStatus: 'todo', ownerId: TEST_USER_ID, taskId: ID, toStatus: 'in_progress', type: 'status_changed' },
				{ fromPriority: 'medium', ownerId: TEST_USER_ID, taskId: ID, toPriority: 'urgent', type: 'priority_changed' },
				{ fromDueDate: null, ownerId: TEST_USER_ID, taskId: ID, toDueDate: dueDate, type: 'due_changed' },
			],
		});
	});

	it('writes no history for untracked or unchanged fields', async () => {
		const prisma = setupUpdate(current({ priority: 'medium', projectId: null }));
		await updateTask(prisma, TEST_USER_ID, ID, { priority: 'medium', title: 'x' });
		expect(prisma.taskEvent.createMany).not.toHaveBeenCalled();
	});

	it('writes no history when the update fails validation', async () => {
		const prisma = setupUpdate(current({ startDate: new Date('2026-11-10') }));
		await rejection(updateTask(prisma, TEST_USER_ID, ID, { dueDate: new Date('2026-11-01'), status: 'done' }));
		expect(prisma.taskEvent.createMany).not.toHaveBeenCalled();
	});

	it('does not touch completedAt when the status is not sent', async () => {
		const prisma = setupUpdate(current());
		await updateTask(prisma, TEST_USER_ID, ID, { title: 'x' });
		expect(dataOf(prisma)).toEqual({ completedAt: undefined, title: 'x' });
	});

	it('rejects a due date before the stored start date', async () => {
		const prisma = setupUpdate(current({ startDate: new Date('2026-11-10') }));
		expect(await rejection(updateTask(prisma, TEST_USER_ID, ID, { dueDate: new Date('2026-11-01') }))).toMatchObject({ details: [{ code: 'due_before_start', field: 'dueDate' }], status: 422 });
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
	});

	it('replaces the tag set', async () => {
		const prisma = setupUpdate(current());
		vi.mocked(prisma.tag.count).mockResolvedValue(1);
		await updateTask(prisma, TEST_USER_ID, ID, { tagIds: [TAG_ID] });
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
		expect(prisma.taskTag.deleteMany).toHaveBeenCalledWith({ where: { taskId: ID } });
		expect(prisma.taskTag.createMany).toHaveBeenCalledWith({ data: [{ tagId: TAG_ID, taskId: ID }] });
	});

	it('throws 404 for another owner’s task', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(updateTask(prisma, OTHER_USER_ID, ID, { title: 'x' }))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
	});

	it('rejects being its own parent', async () => {
		const prisma = setupUpdate(current());
		expect(await rejection(updateTask(prisma, TEST_USER_ID, ID, { parentId: ID }))).toMatchObject({ details: [{ code: 'self_parent', field: 'parentId' }] });
	});

	it('rejects a task that has subtasks becoming a subtask', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst)
			.mockResolvedValueOnce(asRow(current()))
			.mockResolvedValue(asRow({ id: PARENT_ID, parentId: null }));
		vi.mocked(prisma.task.count).mockResolvedValue(2);
		expect(await rejection(updateTask(prisma, TEST_USER_ID, ID, { parentId: PARENT_ID }))).toMatchObject({ details: [{ code: 'has_subtasks', field: 'parentId' }] });
	});
});

describe('deleteTask', () => {
	it('deletes scoped by owner and removes the files of the task and its subtasks', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: PARENT_ID }]));
		vi.mocked(prisma.attachment.findMany).mockResolvedValue(asRow([{ storagePath: 'u/1/file' }]));
		vi.mocked(prisma.task.deleteMany).mockResolvedValue({ count: 1 });

		await deleteTask(prisma, storage, TEST_USER_ID, ID);
		expect(prisma.attachment.findMany).toHaveBeenCalledWith({ select: { storagePath: true }, where: { ownerId: TEST_USER_ID, taskId: { in: [ID, PARENT_ID] } } });
		expect(prisma.task.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
		expect(storage.remove).toHaveBeenCalledWith('private', ['u/1/file']);
	});

	it('throws 404 for another owner and removes nothing', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);
		vi.mocked(prisma.task.deleteMany).mockResolvedValue({ count: 0 });
		expect(await rejection(deleteTask(prisma, storage, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(storage.remove).not.toHaveBeenCalled();
	});
});
