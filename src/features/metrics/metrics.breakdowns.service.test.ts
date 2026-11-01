import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, TEST_USER_ID } from '../../test/helpers.js';
import { getBlockers, getDistribution, getRhythm } from './metrics.breakdowns.service.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const at = (iso: string) => new Date(iso);
const query = { from: '2026-11-01', to: '2026-11-10' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
type Any = any;
const setup = (timezone: string | null = null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(timezone ? ({ timezone } as never) : null);
	return prisma;
};

describe('getDistribution', () => {
	const arrange = () => {
		const prisma = setup();
		vi.mocked(prisma.task.groupBy).mockImplementation(((args: Any) => {
			const by = args.by[0];
			const completed = Boolean(args.where.completedAt);
			if (by === 'status')
				return Promise.resolve([
					{ _count: { _all: 4 }, status: 'todo' },
					{ _count: { _all: 6 }, status: 'done' },
				]);
			if (by === 'priority')
				return Promise.resolve(
					completed
						? [{ _count: { _all: 5 }, priority: 'high' }]
						: [
								{ _count: { _all: 2 }, priority: 'high' },
								{ _count: { _all: 1 }, priority: 'low' },
							]
				);
			return Promise.resolve(
				completed
					? [
							{ _count: { _all: 3 }, projectId: 'p1' },
							{ _count: { _all: 1 }, projectId: null },
						]
					: [
							{ _count: { _all: 2 }, projectId: 'p2' },
							{ _count: { _all: 1 }, projectId: 'p1' },
						]
			);
		}) as Any);
		vi.mocked(prisma.project.findMany).mockResolvedValue([
			{ id: 'p1', title: 'Launch' },
			{ id: 'p2', title: 'Website' },
		] as Any);
		return prisma;
	};

	it('breaks tasks down by status, priority and project with zeros for the missing ones', async () => {
		const result = await getDistribution(arrange(), TEST_USER_ID, query, NOW);
		expect(result.byStatus).toEqual([
			{ count: 4, status: 'todo' },
			{ count: 0, status: 'in_progress' },
			{ count: 6, status: 'done' },
			{ count: 0, status: 'cancelled' },
		]);
		expect(result.byPriority).toEqual([
			{ completed: 0, open: 0, priority: 'urgent' },
			{ completed: 5, open: 2, priority: 'high' },
			{ completed: 0, open: 0, priority: 'medium' },
			{ completed: 0, open: 1, priority: 'low' },
		]);
		expect(result.byProject).toEqual([
			{ completed: 3, open: 1, projectId: 'p1', title: 'Launch' },
			{ completed: 1, open: 0, projectId: null, title: null },
			{ completed: 0, open: 2, projectId: 'p2', title: 'Website' },
		]);
	});

	it('scopes every query by owner and applies the task filters', async () => {
		const prisma = arrange();
		await getDistribution(prisma, TEST_USER_ID, { ...query, goalId: 'g1' }, NOW);
		for (const call of vi.mocked(prisma.task.groupBy).mock.calls) expect((call[0] as Any).where).toMatchObject({ goalId: 'g1', ownerId: TEST_USER_ID });
		expect(vi.mocked(prisma.project.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ ownerId: TEST_USER_ID });
	});

	it('does not look up projects when there are none', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.groupBy).mockResolvedValue([] as Any);
		const result = await getDistribution(prisma, TEST_USER_ID, query, NOW);
		expect(result.byProject).toEqual([]);
		expect(prisma.project.findMany).not.toHaveBeenCalled();
	});
});

describe('getBlockers', () => {
	it('groups by reason ignoring case, most frequent first, with resolution time and open ones', async () => {
		const prisma = setup();
		vi.mocked(prisma.taskBlocker.findMany).mockResolvedValue([
			{ reason: 'Waiting for design', resolvedAt: at('2026-11-02T12:00:00Z'), startedAt: at('2026-11-02T10:00:00Z') },
			{ reason: ' waiting for design ', resolvedAt: at('2026-11-04T10:00:00Z'), startedAt: at('2026-11-04T07:00:00Z') },
			{ reason: 'waiting for DESIGN', resolvedAt: null, startedAt: at('2026-11-06T10:00:00Z') },
			{ reason: 'No access', resolvedAt: null, startedAt: at('2026-11-07T10:00:00Z') },
		] as Any);
		const result = await getBlockers(prisma, TEST_USER_ID, query, NOW);
		expect(result.reasons).toEqual([
			{ averageResolutionHours: 2.5, occurrences: 3, reason: 'Waiting for design', stillOpen: 1 },
			{ averageResolutionHours: null, occurrences: 1, reason: 'No access', stillOpen: 1 },
		]);
		expect(result).toMatchObject({ open: 2, resolved: 2, total: 4 });
	});

	it('scopes by owner and filters through the task', async () => {
		const prisma = setup();
		vi.mocked(prisma.taskBlocker.findMany).mockResolvedValue([]);
		const result = await getBlockers(prisma, TEST_USER_ID, { ...query, projectId: 'p1' }, NOW);
		expect(result).toMatchObject({ open: 0, reasons: [], resolved: 0, total: 0 });
		expect(vi.mocked(prisma.taskBlocker.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ ownerId: TEST_USER_ID, task: { projectId: 'p1' } });
	});
});

describe('getRhythm', () => {
	it('counts completions by ISO weekday and local hour, and reports the peak', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([
			{ completedAt: at('2026-11-02T09:10:00Z') },
			{ completedAt: at('2026-11-09T09:50:00Z') },
			{ completedAt: at('2026-11-03T15:00:00Z') },
			{ completedAt: null },
		] as Any);
		const result = await getRhythm(prisma, TEST_USER_ID, query, NOW);
		expect(result.total).toBe(4);
		expect(result.byHour).toHaveLength(24);
		expect(result.byHour[9]).toEqual({ completed: 2, hour: 9 });
		expect(result.byWeekday[0]).toEqual({ completed: 2, weekday: 1 });
		expect(result.byWeekday[1]).toEqual({ completed: 1, weekday: 2 });
		expect(result.peak).toEqual({ hour: 9, weekday: 1 });
	});

	it('uses the timezone of the user and has no peak without completions', async () => {
		const lima = setup('America/Lima');
		vi.mocked(lima.task.findMany).mockResolvedValue([{ completedAt: at('2026-11-03T03:00:00Z') }] as Any);
		const result = await getRhythm(lima, TEST_USER_ID, query, NOW);
		expect(result.byHour[22]?.completed).toBe(1);
		expect(result.byWeekday[0]?.completed).toBe(1);
		const empty = setup();
		vi.mocked(empty.task.findMany).mockResolvedValue([]);
		expect((await getRhythm(empty, TEST_USER_ID, query, NOW)).peak).toBeNull();
		expect(vi.mocked(empty.task.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ ownerId: TEST_USER_ID });
	});
});
