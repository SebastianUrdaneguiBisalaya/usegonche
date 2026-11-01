import type { TaskEvent } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { diffTaskChanges, listTaskHistory, recordTaskEvents } from './history.service.js';

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

	it('fetches limit + 1 events of an owned task, newest first', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: TASK } as never);
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([event]);
		expect(await listTaskHistory(prisma, TEST_USER_ID, TASK, 20)).toEqual([event]);
		expect(prisma.task.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { id: TASK, ownerId: TEST_USER_ID } });
		expect(prisma.taskEvent.findMany).toHaveBeenCalledWith({ orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 21, where: { ownerId: TEST_USER_ID, taskId: TASK } });
	});

	it('continues after a cursor keeping the owner scope', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue({ id: TASK } as never);
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([]);
		const cursor = { at: new Date('2026-11-01T10:00:00.000Z'), id: TASK };
		await listTaskHistory(prisma, TEST_USER_ID, TASK, 10, cursor);
		expect(vi.mocked(prisma.taskEvent.findMany).mock.calls[0]?.[0]?.where).toMatchObject({
			OR: [{ occurredAt: { lt: cursor.at } }, { id: { lt: TASK }, occurredAt: cursor.at }],
			ownerId: TEST_USER_ID,
			taskId: TASK,
		});
	});

	it('throws 404 for a task that is not the owner’s', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(listTaskHistory(prisma, OTHER_USER_ID, TASK, 10))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.taskEvent.findMany).not.toHaveBeenCalled();
	});
});
