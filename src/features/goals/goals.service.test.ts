import type { Goal } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { archiveGoal, createGoal, getGoal, listGoals, unarchiveGoal, updateGoal } from './goals.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const goal = { id: ID, ownerId: TEST_USER_ID, status: 'active', title: 'Ship v1' } as Goal;
const withStats = { ...goal, projectCount: 0, taskCounts: { done: 0, total: 0 } };

/** A mock client whose goals have no projects or tasks unless a test says otherwise. */
const createPrisma = () => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.project.findMany).mockResolvedValue([]);
	vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
	vi.mocked(prisma.goal.groupBy).mockResolvedValue([] as never);
	return prisma;
};

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('listGoals', () => {
	it('hides archived goals by default and scopes by owner', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([goal]);
		vi.mocked(prisma.goal.count).mockResolvedValue(1);

		expect(await listGoals(prisma, TEST_USER_ID, { archived: false }, { page: 1, pageSize: 20 })).toEqual({ counts: { achieved: 0, active: 0, archived: 1 }, items: [withStats], total: 1 });
		expect(prisma.goal.findMany).toHaveBeenCalledWith({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20, where: { archivedAt: null, ownerId: TEST_USER_ID } });
		expect(prisma.goal.count).toHaveBeenCalledWith({ where: { archivedAt: null, ownerId: TEST_USER_ID } });
	});

	it('lists archived goals filtered by status on a later page', async () => {
		const prisma = createPrisma();
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

describe('listGoals counters, due filter, sort and progress', () => {
	const NOW = new Date('2026-11-10T15:30:00.000Z');
	const TODAY = new Date('2026-11-10T00:00:00.000Z');

	it('counts every tab with the due filter but not the status', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
		vi.mocked(prisma.goal.count).mockResolvedValue(0);
		vi.mocked(prisma.goal.groupBy).mockResolvedValue([
			{ _count: { _all: 5 }, status: 'active' },
			{ _count: { _all: 3 }, status: 'achieved' },
		] as never);

		const page = await listGoals(prisma, TEST_USER_ID, { archived: false, due: 'overdue', status: 'active' }, { page: 1, pageSize: 20 }, NOW);
		expect(page.counts).toEqual({ achieved: 3, active: 5, archived: 0 });
		const due = { status: 'active', targetDate: { lt: TODAY } };
		expect(prisma.goal.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null, ownerId: TEST_USER_ID, ...due } }));
		expect(prisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null, ownerId: TEST_USER_ID, ...due } }));
	});

	it('"soon" is the next 14 days, starting today', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
		await listGoals(prisma, TEST_USER_ID, { archived: false, due: 'soon' }, { page: 1, pageSize: 20 }, NOW);
		expect(vi.mocked(prisma.goal.findMany).mock.calls[0]?.[0]?.where).toEqual({
			archivedAt: null,
			ownerId: TEST_USER_ID,
			status: 'active',
			targetDate: { gte: TODAY, lte: new Date('2026-11-24T00:00:00.000Z') },
		});
	});

	it('sorts by target date with the goals that have none last', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
		await listGoals(prisma, TEST_USER_ID, { archived: false, order: 'asc', sort: 'targetDate' }, { page: 1, pageSize: 20 });
		expect(prisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ targetDate: { nulls: 'last', sort: 'asc' } }, { id: 'asc' }] }));
	});

	it('attaches the project count and progress: direct tasks plus tasks of its projects with no goal of their own', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findMany).mockResolvedValue([goal]);
		vi.mocked(prisma.project.findMany).mockResolvedValue([{ goalId: ID, id: 'p1' }] as never);
		vi.mocked(prisma.task.groupBy)
			.mockResolvedValueOnce([{ _count: { _all: 2 }, goalId: ID, status: 'done' }] as never)
			.mockResolvedValueOnce([
				{ _count: { _all: 1 }, projectId: 'p1', status: 'done' },
				{ _count: { _all: 3 }, projectId: 'p1', status: 'todo' },
			] as never);

		const { items } = await listGoals(prisma, TEST_USER_ID, { archived: false }, { page: 1, pageSize: 20 });
		expect(items[0]).toMatchObject({ projectCount: 1, taskCounts: { done: 3, total: 6 } });
		expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null, goalId: { in: [ID] }, ownerId: TEST_USER_ID } }));
		expect(vi.mocked(prisma.task.groupBy).mock.calls[0]?.[0]?.where).toEqual({ goalId: { in: [ID] }, ownerId: TEST_USER_ID, status: { not: 'cancelled' } });
		expect(vi.mocked(prisma.task.groupBy).mock.calls[1]?.[0]?.where).toEqual({ goalId: null, ownerId: TEST_USER_ID, projectId: { in: ['p1'] }, status: { not: 'cancelled' } });
	});
});

describe('getGoal', () => {
	it('returns the owner goal', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect(await getGoal(prisma, TEST_USER_ID, ID)).toEqual(withStats);
		expect(prisma.goal.findFirst).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 when missing or owned by someone else', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

		expect(await rejection(getGoal(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.goal.findFirst).toHaveBeenCalledWith({ where: { id: ID, ownerId: OTHER_USER_ID } });
	});
});

describe('createGoal', () => {
	it('creates the goal for the owner', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.create).mockResolvedValue({ id: ID } as Goal);
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect(await createGoal(prisma, TEST_USER_ID, { title: 'Ship v1' })).toEqual(withStats);
		expect(prisma.goal.create).toHaveBeenCalledWith({ data: { description: undefined, ownerId: TEST_USER_ID, targetDate: undefined, title: 'Ship v1' }, select: { id: true } });
	});
});

describe('updateGoal', () => {
	it('updates scoped by owner and returns the fresh goal', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect(await updateGoal(prisma, TEST_USER_ID, ID, { status: 'achieved' })).toEqual(withStats);
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { status: 'achieved' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('is idempotent: sending the stored values answers the goal and writes nothing', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		expect(await updateGoal(prisma, TEST_USER_ID, ID, { status: 'active', targetDate: null, title: 'Ship v1' })).toEqual(withStats);
		expect(prisma.goal.updateMany).not.toHaveBeenCalled();
	});

	it('writes only the fields that changed', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);
		await updateGoal(prisma, TEST_USER_ID, ID, { status: 'achieved', title: 'Ship v1' });
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { status: 'achieved' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 when nothing matches the owner', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

		expect(await rejection(updateGoal(prisma, OTHER_USER_ID, ID, { title: 'x' }))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('archiveGoal / unarchiveGoal', () => {
	it('archives only goals that are not archived yet, scoped by owner', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		await archiveGoal(prisma, TEST_USER_ID, ID);
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { archivedAt: expect.any(Date) }, where: { archivedAt: null, id: ID, ownerId: TEST_USER_ID } });
	});

	it('unarchives only archived goals, scoped by owner', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(goal);

		await unarchiveGoal(prisma, TEST_USER_ID, ID);
		expect(prisma.goal.updateMany).toHaveBeenCalledWith({ data: { archivedAt: null }, where: { archivedAt: { not: null }, id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 for goals of another owner', async () => {
		const prisma = createPrisma();
		vi.mocked(prisma.goal.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

		expect(await rejection(archiveGoal(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(await rejection(unarchiveGoal(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
