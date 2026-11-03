import type { TaskEvent } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { diffTaskChanges, listActivity, listTaskHistory, recordTaskEvents } from './history.service.js';

const TASK = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const PROJECT_A = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const PROJECT_B = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const before = { dueDate: new Date('2026-11-10'), priority: 'medium', projectId: PROJECT_A, status: 'todo' } as const;

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('diffTaskChanges', () => {
	it('produces nothing when nothing is sent or nothing changes', () => {
		expect(diffTaskChanges(before, {})).toEqual([]);
		expect(diffTaskChanges(before, { dueDate: new Date('2026-11-10'), priority: 'medium', projectId: PROJECT_A, status: 'todo' })).toEqual([]);
	});

	it('records status and priority changes with from/to', () => {
		expect(diffTaskChanges(before, { priority: 'urgent', status: 'done' })).toEqual([
			{ fromStatus: 'todo', toStatus: 'done', type: 'status_changed' },
			{ fromPriority: 'medium', toPriority: 'urgent', type: 'priority_changed' },
		]);
	});

	it('records due date changes including setting and clearing it', () => {
		expect(diffTaskChanges(before, { dueDate: new Date('2026-11-12') })).toEqual([{ fromDueDate: before.dueDate, toDueDate: new Date('2026-11-12'), type: 'due_changed' }]);
		expect(diffTaskChanges(before, { dueDate: null })).toEqual([{ fromDueDate: before.dueDate, toDueDate: null, type: 'due_changed' }]);
		expect(diffTaskChanges({ ...before, dueDate: null }, { dueDate: new Date('2026-11-12') })).toEqual([{ fromDueDate: null, toDueDate: new Date('2026-11-12'), type: 'due_changed' }]);
		expect(diffTaskChanges({ ...before, dueDate: null }, { dueDate: null })).toEqual([]);
	});

	it('records project changes including unlinking', () => {
		expect(diffTaskChanges(before, { projectId: PROJECT_B })).toEqual([{ fromProjectId: PROJECT_A, toProjectId: PROJECT_B, type: 'project_changed' }]);
		expect(diffTaskChanges(before, { projectId: null })).toEqual([{ fromProjectId: PROJECT_A, toProjectId: null, type: 'project_changed' }]);
	});
});

describe('recordTaskEvents', () => {
	it('writes every event for the owner and task in one insert', async () => {
		const prisma = createMockPrisma();
		await recordTaskEvents(prisma, TEST_USER_ID, TASK, [
			{ fromStatus: 'todo', toStatus: 'done', type: 'status_changed' },
			{ fromPriority: 'low', toPriority: 'high', type: 'priority_changed' },
		]);
		expect(prisma.taskEvent.createMany).toHaveBeenCalledWith({
			data: [
				{ fromStatus: 'todo', ownerId: TEST_USER_ID, taskId: TASK, toStatus: 'done', type: 'status_changed' },
				{ fromPriority: 'low', ownerId: TEST_USER_ID, taskId: TASK, toPriority: 'high', type: 'priority_changed' },
			],
		});
	});

	it('does not touch the database without events', async () => {
		const prisma = createMockPrisma();
		await recordTaskEvents(prisma, TEST_USER_ID, TASK, []);
		expect(prisma.taskEvent.createMany).not.toHaveBeenCalled();
	});
});

describe('listTaskHistory', () => {
	const event = { id: 'e1', ownerId: TEST_USER_ID, taskId: TASK, type: 'status_changed' } as TaskEvent;

	it('fetches a page of events of an owned task, newest first, with the total', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: TASK } as never);
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([event]);
		vi.mocked(prisma.taskEvent.count).mockResolvedValue(1);
		expect(await listTaskHistory(prisma, TEST_USER_ID, TASK, { page: 1, pageSize: 20 })).toEqual({ items: [event], total: 1 });
		expect(prisma.task.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { id: TASK, ownerId: TEST_USER_ID } });
		expect(prisma.taskEvent.findMany).toHaveBeenCalledWith({ orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20, where: { ownerId: TEST_USER_ID, taskId: TASK } });
	});

	it('skips the previous pages keeping the owner scope', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: TASK } as never);
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([]);
		await listTaskHistory(prisma, TEST_USER_ID, TASK, { page: 4, pageSize: 10 });
		expect(vi.mocked(prisma.taskEvent.findMany).mock.calls[0]?.[0]).toMatchObject({ skip: 30, take: 10, where: { ownerId: TEST_USER_ID, taskId: TASK } });
	});

	it('throws 404 for a task that is not the owner’s', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(listTaskHistory(prisma, OTHER_USER_ID, TASK, { page: 1, pageSize: 10 }))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.taskEvent.findMany).not.toHaveBeenCalled();
	});
});

describe('listActivity', () => {
	const row = { id: 'e1', ownerId: TEST_USER_ID, task: { title: 'Write docs' }, taskId: TASK, type: 'status_changed' } as unknown as TaskEvent & { task: { title: string } };

	it('fetches a page of the owner’s events across all tasks, newest first, each with its task title', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([row] as never);
		vi.mocked(prisma.taskEvent.count).mockResolvedValue(7);
		const page = await listActivity(prisma, TEST_USER_ID, { page: 1, pageSize: 20 });
		expect(page.total).toBe(7);
		expect(page.items).toEqual([{ id: 'e1', ownerId: TEST_USER_ID, taskId: TASK, taskTitle: 'Write docs', type: 'status_changed' }]);
		expect(page.items[0]).not.toHaveProperty('task');
		expect(prisma.taskEvent.findMany).toHaveBeenCalledWith({
			include: { task: { select: { title: true } } },
			orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
			skip: 0,
			take: 20,
			where: { ownerId: TEST_USER_ID },
		});
		expect(prisma.taskEvent.count).toHaveBeenCalledWith({ where: { ownerId: TEST_USER_ID } });
	});

	it('skips the previous pages and never reads another owner’s events', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([]);
		await listActivity(prisma, OTHER_USER_ID, { page: 3, pageSize: 10 });
		expect(vi.mocked(prisma.taskEvent.findMany).mock.calls[0]?.[0]).toMatchObject({ skip: 20, take: 10, where: { ownerId: OTHER_USER_ID } });
		expect(vi.mocked(prisma.taskEvent.count).mock.calls[0]?.[0]).toEqual({ where: { ownerId: OTHER_USER_ID } });
	});
});
