import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, TEST_USER_ID } from '../../test/helpers.js';
import { computeStreak, getSummary } from './metrics.summary.service.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const query = { from: '2026-11-01', to: '2026-11-10' };
const CURRENT_START = Date.UTC(2026, 10, 1);
const at = (iso: string) => new Date(iso);

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
type Any = any;
const isCurrent = (gte: Date) => gte.getTime() >= CURRENT_START;

const setup = () => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
	vi.mocked(prisma.task.count).mockImplementation(((args: Any) => {
		const where = args.where;
		if (where.createdAt) return Promise.resolve(isCurrent(where.createdAt.gte) ? 5 : 2);
		if (where.blockers) return Promise.resolve(1);
		if (where.dueDate) return Promise.resolve(3);
		return Promise.resolve(7);
	}) as Any);
	vi.mocked(prisma.task.findMany).mockImplementation(((args: Any) => {
		if (args.select.id) {
			if (!isCurrent(args.where.completedAt.gte)) return Promise.resolve([]);
			return Promise.resolve([
				{ completedAt: at('2026-11-03T10:00:00Z'), dueDate: at('2026-11-03T00:00:00Z'), estimatedMinutes: 60, id: 'a' },
				{ completedAt: at('2026-11-05T10:00:00Z'), dueDate: at('2026-11-04T00:00:00Z'), estimatedMinutes: null, id: 'b' },
				{ completedAt: at('2026-11-06T10:00:00Z'), dueDate: null, estimatedMinutes: null, id: 'c' },
			]);
		}
		return Promise.resolve([
			{ completedAt: at('2026-11-10T08:00:00Z') },
			{ completedAt: at('2026-11-09T08:00:00Z') },
			{ completedAt: at('2026-11-08T08:00:00Z') },
			{ completedAt: at('2026-11-05T08:00:00Z') },
		]);
	}) as Any);
	vi.mocked(prisma.dailyPlanItem.findMany).mockImplementation(((args: Any) =>
		Promise.resolve(
			isCurrent(args.where.plan.date.gte)
				? [
						{ task: { status: 'done' }, taskId: 'a' },
						{ task: { status: 'todo' }, taskId: 'b' },
					]
				: []
		)) as Any);
	vi.mocked(prisma.timeBlock.findMany).mockImplementation(((args: Any) => {
		if ('taskId' in args.select) return Promise.resolve([{ actualEnd: at('2026-11-03T10:30:00Z'), actualStart: at('2026-11-03T09:00:00Z'), taskId: 'a' }]);
		if (!isCurrent(args.where.plannedStart.gte)) return Promise.resolve([]);
		return Promise.resolve([
			{ actualEnd: at('2026-11-03T10:15:00Z'), actualStart: at('2026-11-03T09:00:00Z'), plannedEnd: at('2026-11-03T10:00:00Z'), plannedStart: at('2026-11-03T09:00:00Z'), status: 'done' },
			{ actualEnd: null, actualStart: null, plannedEnd: at('2026-11-04T14:30:00Z'), plannedStart: at('2026-11-04T14:00:00Z'), status: 'missed' },
		]);
	}) as Any);
	vi.mocked(prisma.taskEvent.count).mockImplementation(((args: Any) => Promise.resolve(isCurrent(args.where.occurredAt.gte) ? 4 : 0)) as Any);
	return prisma;
};

describe('getSummary', () => {
	it('computes the period figures with the counts behind each rate', async () => {
		const { current, range } = await getSummary(setup(), TEST_USER_ID, query, NOW);
		expect(range).toEqual({ from: '2026-11-01', timeZone: 'UTC', to: '2026-11-10' });
		expect(current).toEqual({
			estimates: { actualMinutes: 90, estimatedMinutes: 60, tasks: 1 },
			focusMinutes: 75,
			onTime: { done: 1, rate: 0.5, total: 2 },
			planCompletion: { done: 1, rate: 0.5, total: 2 },
			plannedMinutes: 90,
			reschedules: 4,
			tasksCompleted: 3,
			tasksCreated: 5,
		});
	});

	it('computes the previous period of the same length for comparison', async () => {
		const { previous } = await getSummary(setup(), TEST_USER_ID, query, NOW);
		expect(previous).toEqual({
			estimates: { actualMinutes: 0, estimatedMinutes: 0, tasks: 0 },
			focusMinutes: 0,
			onTime: { done: 0, rate: null, total: 0 },
			planCompletion: { done: 0, rate: null, total: 0 },
			plannedMinutes: 0,
			reschedules: 0,
			tasksCompleted: 0,
			tasksCreated: 2,
		});
	});

	it('adds the snapshot: open, overdue, blocked and the streak', async () => {
		const { snapshot } = await getSummary(setup(), TEST_USER_ID, query, NOW);
		expect(snapshot).toEqual({ blocked: 1, openTasks: 7, overdue: 3, streak: { current: 3, longest: 3 } });
	});

	it('scopes every query by owner', async () => {
		const prisma = setup();
		await getSummary(prisma, TEST_USER_ID, query, NOW);
		for (const model of [prisma.task.count, prisma.task.findMany, prisma.dailyPlanItem.findMany, prisma.timeBlock.findMany, prisma.taskEvent.count]) {
			for (const call of vi.mocked(model).mock.calls) expect((call[0] as Any).where.ownerId).toBe(TEST_USER_ID);
		}
	});

	it('narrows tasks directly and the other models through their task when filtering', async () => {
		const prisma = setup();
		await getSummary(prisma, TEST_USER_ID, { ...query, priority: 'high', projectId: 'p1' }, NOW);
		for (const call of vi.mocked(prisma.task.count).mock.calls) expect((call[0] as Any).where).toMatchObject({ priority: 'high', projectId: 'p1' });
		for (const model of [prisma.dailyPlanItem.findMany, prisma.timeBlock.findMany, prisma.taskEvent.count]) {
			for (const call of vi.mocked(model).mock.calls) if (!(call[0] as Any).where.taskId) expect((call[0] as Any).where.task).toEqual({ priority: 'high', projectId: 'p1' });
		}
	});

	it('answers 422 for an invalid range', async () => {
		await expect(getSummary(setup(), TEST_USER_ID, { from: '2026-11-10', to: '2026-11-01' }, NOW)).rejects.toMatchObject({ status: 422 });
	});
});

describe('computeStreak', () => {
	it('counts from today, or from yesterday when today has no completion yet', () => {
		expect(computeStreak(new Set(['2026-11-10', '2026-11-09']), '2026-11-10').current).toBe(2);
		expect(computeStreak(new Set(['2026-11-09', '2026-11-08']), '2026-11-10').current).toBe(2);
	});

	it('is broken by a day without completions and keeps the longest run', () => {
		expect(computeStreak(new Set(['2026-11-08']), '2026-11-10').current).toBe(0);
		expect(computeStreak(new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10']), '2026-11-10')).toEqual({ current: 1, longest: 3 });
	});

	it('is zero without completions', () => {
		expect(computeStreak(new Set(), '2026-11-10')).toEqual({ current: 0, longest: 0 });
	});
});
