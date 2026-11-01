import type { TaskBlocker } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createBlocker, listBlockers, resolveBlocker } from './tasks.blockers.service.js';

const TASK = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const BLOCKER = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const blocker = { id: BLOCKER, ownerId: TEST_USER_ID, reason: 'waiting for design', taskId: TASK } as TaskBlocker;

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('listBlockers', () => {
	it('lists all blockers (resolved too) of an owned task', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TASK }));
		vi.mocked(prisma.taskBlocker.findMany).mockResolvedValue([blocker]);
		expect(await listBlockers(prisma, TEST_USER_ID, TASK)).toEqual([blocker]);
		expect(prisma.taskBlocker.findMany).toHaveBeenCalledWith({ orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], where: { ownerId: TEST_USER_ID, taskId: TASK } });
	});

	it('throws 404 when the task is not the owner’s', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(listBlockers(prisma, OTHER_USER_ID, TASK))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.taskBlocker.findMany).not.toHaveBeenCalled();
	});
});

describe('createBlocker', () => {
	it('creates an open blocker for the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TASK }));
		vi.mocked(prisma.taskBlocker.create).mockResolvedValue(blocker);
		expect(await createBlocker(prisma, TEST_USER_ID, TASK, 'waiting for design')).toBe(blocker);
		expect(prisma.taskBlocker.create).toHaveBeenCalledWith({ data: { ownerId: TEST_USER_ID, reason: 'waiting for design', taskId: TASK } });
	});

	it('throws 404 when the task is not the owner’s', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(createBlocker(prisma, OTHER_USER_ID, TASK, 'x'))).toMatchObject({ status: 404 });
		expect(prisma.taskBlocker.create).not.toHaveBeenCalled();
	});
});

describe('resolveBlocker', () => {
	it('resolves an open blocker scoped by owner and task', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.taskBlocker.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.taskBlocker.findFirst).mockResolvedValue(blocker);
		expect(await resolveBlocker(prisma, TEST_USER_ID, TASK, BLOCKER)).toBe(blocker);
		expect(prisma.taskBlocker.updateMany).toHaveBeenCalledWith({ data: { resolvedAt: expect.any(Date) }, where: { id: BLOCKER, ownerId: TEST_USER_ID, resolvedAt: null, taskId: TASK } });
	});

	it('throws 409 when it was already resolved', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.taskBlocker.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.taskBlocker.findFirst).mockResolvedValue(blocker);
		expect(await rejection(resolveBlocker(prisma, TEST_USER_ID, TASK, BLOCKER))).toMatchObject({ code: 'invalid_state', status: 409 });
	});

	it('throws 404 for another owner’s blocker', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.taskBlocker.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.taskBlocker.findFirst).mockResolvedValue(null);
		expect(await rejection(resolveBlocker(prisma, OTHER_USER_ID, TASK, BLOCKER))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
