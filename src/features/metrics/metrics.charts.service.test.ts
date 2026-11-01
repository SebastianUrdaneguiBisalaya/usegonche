import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, TEST_USER_ID } from '../../test/helpers.js';
import { getFocusTime, getPlanningReliability, getThroughput } from './metrics.charts.service.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const at = (iso: string) => new Date(iso);

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
type Any = any;
const setup = (timezone: string | null = null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(timezone ? ({ timezone } as never) : null);
	return prisma;
};

describe('getThroughput', () => {
	it('returns every day of the range with created and completed counts (zeros included)', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.findMany).mockImplementation(((args: Any) =>
			Promise.resolve(args.select.createdAt ? [{ createdAt: at('2026-11-08T10:00:00Z') }, { createdAt: at('2026-11-08T11:00:00Z') }] : [{ completedAt: at('2026-11-10T09:00:00Z') }])) as Any);
		const result = await getThroughput(prisma, TEST_USER_ID, { from: '2026-11-08', granularity: 'day', to: '2026-11-10' }, NOW);
		expect(result.series).toEqual([
			{ completed: 0, created: 2, date: '2026-11-08' },
			{ completed: 0, created: 0, date: '2026-11-09' },
			{ completed: 1, created: 0, date: '2026-11-10' },
		]);
		expect(result.totals).toEqual({ completed: 1, created: 2 });
	});

	it('groups by ISO week, labelled by its Monday, including partial weeks at the edges', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.findMany).mockImplementation(((args: Any) =>
			Promise.resolve(args.select.createdAt ? [{ createdAt: at('2026-11-01T10:00:00Z') }, { createdAt: at('2026-11-10T10:00:00Z') }] : [{ completedAt: at('2026-11-04T10:00:00Z') }])) as Any);
		const result = await getThroughput(prisma, TEST_USER_ID, { from: '2026-11-01', granularity: 'week', to: '2026-11-10' }, NOW);
		expect(result.granularity).toBe('week');
		expect(result.series).toEqual([
			{ completed: 0, created: 1, date: '2026-10-26' },
			{ completed: 1, created: 0, date: '2026-11-02' },
			{ completed: 0, created: 1, date: '2026-11-09' },
		]);
	});

	it('buckets by the local day of the user timezone and applies the task filters', async () => {
		const prisma = setup('America/Lima');
		vi.mocked(prisma.task.findMany).mockImplementation(((args: Any) => Promise.resolve(args.select.createdAt ? [{ createdAt: at('2026-11-09T03:00:00Z') }] : [])) as Any);
		const result = await getThroughput(prisma, TEST_USER_ID, { from: '2026-11-08', granularity: 'day', tagId: 't1', to: '2026-11-09' }, NOW);
		expect(result.series[0]).toMatchObject({ created: 1, date: '2026-11-08' });
		for (const call of vi.mocked(prisma.task.findMany).mock.calls) expect((call[0] as Any).where).toMatchObject({ ownerId: TEST_USER_ID, tags: { some: { tagId: 't1' } } });
	});
});

describe('getFocusTime', () => {
	it('adds planned and real minutes per day and counts blocks by outcome', async () => {
		const prisma = setup();
		vi.mocked(prisma.timeBlock.findMany).mockResolvedValue([
			{ actualEnd: at('2026-11-09T10:15:00Z'), actualStart: at('2026-11-09T09:00:00Z'), plannedEnd: at('2026-11-09T10:00:00Z'), plannedStart: at('2026-11-09T09:00:00Z'), status: 'done' },
			{ actualEnd: null, actualStart: null, plannedEnd: at('2026-11-09T14:30:00Z'), plannedStart: at('2026-11-09T14:00:00Z'), status: 'missed' },
			{ actualEnd: null, actualStart: null, plannedEnd: at('2026-11-10T11:00:00Z'), plannedStart: at('2026-11-10T10:00:00Z'), status: 'planned' },
		] as Any);
		const result = await getFocusTime(prisma, TEST_USER_ID, { from: '2026-11-09', to: '2026-11-10' }, NOW);
		expect(result.series).toEqual([
			{ actualMinutes: 75, blocks: { done: 1, interrupted: 0, missed: 1, planned: 0 }, date: '2026-11-09', plannedMinutes: 90 },
			{ actualMinutes: 0, blocks: { done: 0, interrupted: 0, missed: 0, planned: 1 }, date: '2026-11-10', plannedMinutes: 60 },
		]);
		expect(result.totals).toEqual({ actualMinutes: 75, plannedMinutes: 150 });
		expect(vi.mocked(prisma.timeBlock.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ ownerId: TEST_USER_ID, status: { not: 'rescheduled' } });
	});

	it('filters through the task and leaves moved blocks out', async () => {
		const prisma = setup();
		vi.mocked(prisma.timeBlock.findMany).mockResolvedValue([]);
		const result = await getFocusTime(prisma, TEST_USER_ID, { from: '2026-11-09', projectId: 'p1', to: '2026-11-09' }, NOW);
		expect(result.series).toHaveLength(1);
		expect(vi.mocked(prisma.timeBlock.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ task: { projectId: 'p1' } });
	});
});

describe('getPlanningReliability', () => {
	it('reports, per plan, how many of its tasks are done and the overall ratio', async () => {
		const prisma = setup();
		vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue([
			{ plan: { date: at('2026-11-09T00:00:00Z') }, task: { status: 'done' } },
			{ plan: { date: at('2026-11-09T00:00:00Z') }, task: { status: 'todo' } },
			{ plan: { date: at('2026-11-10T00:00:00Z') }, task: { status: 'done' } },
		] as Any);
		const result = await getPlanningReliability(prisma, TEST_USER_ID, { from: '2026-11-08', to: '2026-11-10' }, NOW);
		expect(result.series).toEqual([
			{ completed: 1, date: '2026-11-09', planned: 2, rate: 0.5 },
			{ completed: 1, date: '2026-11-10', planned: 1, rate: 1 },
		]);
		expect(result.overall).toEqual({ done: 2, rate: 0.667, total: 3 });
	});

	it('is empty without plans', async () => {
		const prisma = setup();
		vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue([]);
		const result = await getPlanningReliability(prisma, TEST_USER_ID, {}, NOW);
		expect(result.series).toEqual([]);
		expect(result.overall).toEqual({ done: 0, rate: null, total: 0 });
		expect(vi.mocked(prisma.dailyPlanItem.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ ownerId: TEST_USER_ID });
	});
});
