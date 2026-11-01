import { scoped } from '../../lib/owner.js';
import { datesBetween, localDateOf, weekStartOf } from '../../lib/time.js';
import type { RangeQuery, ThroughputQuery } from './metrics.schemas.js';
import { asDbDate, type Db, minutesBetween, type Ratio, ROW_LIMIT, ratio, resolveRange, taskWhere, viaTask } from './metrics.shared.js';

type Granularity = 'day' | 'week';

export type ThroughputPoint = { completed: number; created: number; date: string };
/** Tasks created vs. completed per day (or per week, labelled by its Monday). Every bucket of the range is present, with zeros. */
export type Throughput = { granularity: Granularity; range: { from: string; to: string }; series: ThroughputPoint[]; totals: { completed: number; created: number } };

export type FocusPoint = { actualMinutes: number; blocks: { done: number; interrupted: number; missed: number; planned: number }; date: string; plannedMinutes: number };
/** Time blocks per day: minutes planned vs. minutes really worked (blocks that ended `done`), and how many blocks ended each way. Moved blocks are not counted twice. */
export type FocusTime = { range: { from: string; to: string }; series: FocusPoint[]; totals: { actualMinutes: number; plannedMinutes: number } };

export type PlanningPoint = { completed: number; date: string; planned: number; rate: number | null };
/** For each daily plan: how many of its tasks are done now. */
export type PlanningReliability = { overall: Ratio; range: { from: string; to: string }; series: PlanningPoint[] };

const bucketOf = (date: string, granularity: Granularity): string => (granularity === 'week' ? weekStartOf(date) : date);

const bucketsOf = (from: string, to: string, granularity: Granularity): string[] => [...new Set(datesBetween(from, to).map(date => bucketOf(date, granularity)))];

export const getThroughput = async (prisma: Db, ownerId: string, query: ThroughputQuery, now: Date = new Date()): Promise<Throughput> => {
	const range = await resolveRange(prisma, ownerId, query, now);
	const inRange = { gte: range.start, lt: range.end };
	const [created, completed] = await Promise.all([
		prisma.task.findMany({ select: { createdAt: true }, take: ROW_LIMIT, where: scoped(ownerId, { createdAt: inRange, ...taskWhere(query) }) }),
		prisma.task.findMany({ select: { completedAt: true }, take: ROW_LIMIT, where: scoped(ownerId, { completedAt: inRange, ...taskWhere(query) }) }),
	]);
	const points = new Map<string, ThroughputPoint>(bucketsOf(range.from, range.to, query.granularity).map(date => [date, { completed: 0, created: 0, date }]));
	for (const task of created) {
		const point = points.get(bucketOf(localDateOf(task.createdAt, range.timeZone), query.granularity));
		if (point) point.created += 1;
	}
	for (const task of completed) {
		const point = task.completedAt ? points.get(bucketOf(localDateOf(task.completedAt, range.timeZone), query.granularity)) : undefined;
		if (point) point.completed += 1;
	}
	return { granularity: query.granularity, range: { from: range.from, to: range.to }, series: [...points.values()], totals: { completed: completed.length, created: created.length } };
};

export const getFocusTime = async (prisma: Db, ownerId: string, query: RangeQuery, now: Date = new Date()): Promise<FocusTime> => {
	const range = await resolveRange(prisma, ownerId, query, now);
	const blocks = await prisma.timeBlock.findMany({
		select: { actualEnd: true, actualStart: true, plannedEnd: true, plannedStart: true, status: true },
		take: ROW_LIMIT,
		where: scoped(ownerId, { plannedStart: { gte: range.start, lt: range.end }, status: { not: 'rescheduled' as const }, ...viaTask(query) }),
	});
	const points = new Map<string, FocusPoint>(
		datesBetween(range.from, range.to).map(date => [date, { actualMinutes: 0, blocks: { done: 0, interrupted: 0, missed: 0, planned: 0 }, date, plannedMinutes: 0 }])
	);
	for (const block of blocks) {
		const point = points.get(localDateOf(block.plannedStart, range.timeZone));
		if (!point || block.status === 'rescheduled') continue;
		point.blocks[block.status] += 1;
		point.plannedMinutes += minutesBetween(block.plannedStart, block.plannedEnd);
		if (block.status === 'done' && block.actualStart && block.actualEnd) point.actualMinutes += minutesBetween(block.actualStart, block.actualEnd);
	}
	const series = [...points.values()];
	return {
		range: { from: range.from, to: range.to },
		series,
		totals: { actualMinutes: series.reduce((sum, point) => sum + point.actualMinutes, 0), plannedMinutes: series.reduce((sum, point) => sum + point.plannedMinutes, 0) },
	};
};

export const getPlanningReliability = async (prisma: Db, ownerId: string, query: RangeQuery, now: Date = new Date()): Promise<PlanningReliability> => {
	const range = await resolveRange(prisma, ownerId, query, now);
	const items = await prisma.dailyPlanItem.findMany({
		select: { plan: { select: { date: true } }, task: { select: { status: true } } },
		take: ROW_LIMIT,
		where: scoped(ownerId, { plan: { date: { gte: asDbDate(range.from), lte: asDbDate(range.to) } }, ...viaTask(query) }),
	});
	const byDate = new Map<string, { completed: number; planned: number }>();
	for (const item of items) {
		const date = item.plan.date.toISOString().slice(0, 10);
		const entry = byDate.get(date) ?? { completed: 0, planned: 0 };
		entry.planned += 1;
		if (item.task.status === 'done') entry.completed += 1;
		byDate.set(date, entry);
	}
	const series = datesBetween(range.from, range.to)
		.filter(date => byDate.has(date))
		.map(date => {
			const { completed, planned } = byDate.get(date) ?? { completed: 0, planned: 0 };
			return { completed, date, planned, rate: ratio(completed, planned).rate };
		});
	return {
		overall: ratio(
			series.reduce((sum, point) => sum + point.completed, 0),
			series.reduce((sum, point) => sum + point.planned, 0)
		),
		range: { from: range.from, to: range.to },
		series,
	};
};
