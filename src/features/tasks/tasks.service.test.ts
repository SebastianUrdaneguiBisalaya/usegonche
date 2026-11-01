import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createMockStorage, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createTask, deleteTask, getTask, listTasks, updateTask } from './tasks.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const PARENT_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const TAG_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const INBOX_ID = 'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';
const REF_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const tag = { id: TAG_ID, name: 'work' };
const base = { blockers: [], dependencies: [], id: ID, ownerId: TEST_USER_ID, status: 'todo', subtasks: [], tags: [], title: 'Write' };

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
		expect(await listTasks(prisma, TEST_USER_ID, {}, 20)).toHaveLength(1);
		expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21, where: { ownerId: TEST_USER_ID, parentId: null } }));
	});

	it('applies every filter', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		const dueAfter = new Date('2026-11-01');
		const dueBefore = new Date('2026-11-30');
		await listTasks(prisma, TEST_USER_ID, { dueAfter, dueBefore, goalId: REF_ID, parentId: PARENT_ID, priority: 'high', projectId: REF_ID, status: 'done', tagId: TAG_ID }, 10);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toEqual({
			dueDate: { gte: dueAfter, lte: dueBefore },
			goalId: REF_ID,
			ownerId: TEST_USER_ID,
			parentId: PARENT_ID,
			priority: 'high',
			projectId: REF_ID,
			status: 'done',
			tags: { some: { tagId: TAG_ID } },
		});
	});

	it('continues after a cursor keeping the owner scope', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		const cursor = { at: new Date('2026-11-01T10:00:00.000Z'), id: ID };
		await listTasks(prisma, TEST_USER_ID, {}, 10, cursor);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: ID } }], ownerId: TEST_USER_ID });
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
	const current = (extra: object = {}) => ({ dueDate: null, startDate: null, status: 'todo', ...extra });
	const setupUpdate = (existing: object) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValueOnce(asRow(existing)).mockResolvedValue(asRow(base));
		vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });
		return prisma;
	};
	const dataOf = (prisma: ReturnType<typeof createMockPrisma>) => vi.mocked(prisma.task.updateMany).mock.calls[0]?.[0]?.data;

	it('sets completedAt when entering done', async () => {
		const prisma = setupUpdate(current());
		await updateTask(prisma, TEST_USER_ID, ID, { status: 'done' });
		expect(dataOf(prisma)).toEqual({ completedAt: expect.any(Date), status: 'done' });
		expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID, ownerId: TEST_USER_ID } }));
	});

	it('keeps the original completedAt when done is re-sent', async () => {
		const prisma = setupUpdate(current({ status: 'done' }));
		await updateTask(prisma, TEST_USER_ID, ID, { status: 'done' });
		expect(dataOf(prisma)).toEqual({ completedAt: undefined, status: 'done' });
	});

	it.each(['todo', 'in_progress', 'cancelled'] as const)('clears completedAt when a done task moves to %s', async status => {
		const prisma = setupUpdate(current({ status: 'done' }));
		await updateTask(prisma, TEST_USER_ID, ID, { status });
		expect(dataOf(prisma)).toEqual({ completedAt: null, status });
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
