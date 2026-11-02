import type { Goal } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { archiveGoal, createGoal, getGoal, listGoals, unarchiveGoal, updateGoal } from './goals.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const goal = { id: ID, ownerId: TEST_USER_ID, status: 'active', title: 'Ship v1' } as Goal;

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('listGoals', () => {
	it('hides archived goals by default and scopes by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([goal]);
		vi.mocked(prisma.goal.count).mockResolvedValue(1);

		expect(await listGoals(prisma, TEST_USER_ID, { archived: false }, { page: 1, pageSize: 20 })).toEqual({ items: [goal], total: 1 });
		expect(prisma.goal.findMany).toHaveBeenCalledWith({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20, where: { archivedAt: null, ownerId: TEST_USER_ID } });
		expect(prisma.goal.count).toHaveBeenCalledWith({ where: { archivedAt: null, ownerId: TEST_USER_ID } });
	});

	it('lists archived goals filtered by status on a later page', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([]);

		await listGoals(prisma, TEST_USER_ID, { archived: true, status: 'achieved' }, { page: 3, pageSize: 10 });
		expect(vi.mocked(prisma.goal.findMany).mock.calls[0]?.[0]).toMatchObject({ skip: 20, take: 10 });
		expect(vi.mocked(prisma.goal.findMany).mock.calls[0]?.[0]?.where).toEqual({
			archivedAt: { not: null },
			ownerId: TEST_USER_ID,
			status: 'achieved',
		});
	});
});

describe('getGoal', () => {
	it('returns the owner goal', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect(await getGoal(prisma, TEST_USER_ID, ID)).toBe(goal);
		expect(prisma.goal.findFirst).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 when missing or owned by someone else', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

		expect(await rejection(getGoal(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.goal.findFirst).toHaveBeenCalledWith({ where: { id: ID, ownerId: OTHER_USER_ID } });
	});
});

describe('createGoal', () => {
	it('creates the goal for the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.create).mockResolvedValue(goal);

		expect(await createGoal(prisma, TEST_USER_ID, { title: 'Ship v1' })).toBe(goal);
		expect(prisma.goal.create).toHaveBeenCalledWith({ data: { description: undefined, ownerId: TEST_USER_ID, targetDate: undefined, title: 'Ship v1' } });
	});
});

describe('updateGoal', () => {
	it('updates scoped by owner and returns the fresh goal', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect(await updateGoal(prisma, TEST_USER_ID, ID, { status: 'achieved' })).toBe(goal);
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { status: 'achieved' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('is idempotent: sending the stored values answers the goal and writes nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect(await updateGoal(prisma, TEST_USER_ID, ID, { status: 'active', targetDate: null, title: 'Ship v1' })).toBe(goal);
		expect(prisma.goal.updateMany).not.toHaveBeenCalled();
	});

	it('writes only the fields that changed', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);
		await updateGoal(prisma, TEST_USER_ID, ID, { status: 'achieved', title: 'Ship v1' });
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { status: 'achieved' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 when nothing matches the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

		expect(await rejection(updateGoal(prisma, OTHER_USER_ID, ID, { title: 'x' }))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('archiveGoal / unarchiveGoal', () => {
	it('archives only goals that are not archived yet, scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		await archiveGoal(prisma, TEST_USER_ID, ID);
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { archivedAt: expect.any(Date) }, where: { archivedAt: null, id: ID, ownerId: TEST_USER_ID } });
	});

	it('unarchives only archived goals, scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		await unarchiveGoal(prisma, TEST_USER_ID, ID);
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { archivedAt: null }, where: { archivedAt: { not: null }, id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 for goals of another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

		expect(await rejection(archiveGoal(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(await rejection(unarchiveGoal(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
