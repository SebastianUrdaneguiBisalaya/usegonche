import { scoped } from '../../lib/owner.js';
import { addDays, datesBetween, dayRange, localDateOf } from '../../lib/time.js';
import type { RangeQuery } from './metrics.schemas.js';
import { asDbDate, type Db, minutesBetween, previousRange, type Range, type Ratio, ROW_LIMIT, ratio, resolveRange, taskWhere, viaTask } from './metrics.shared.js';

/** Everything a card of the dashboard needs for one period. */
export type PeriodFigures = {
	/** Estimated vs. real time of the tasks completed in the period that had an estimate and at least one finished time block. */
	estimates: { actualMinutes: number; estimatedMinutes: number; tasks: number };
	/** Minutes actually worked in time blocks that ended `done`. */
	focusMinutes: number;
	/** Completed tasks that had a due date: how many were finished on or before it. */
	onTime: Ratio;
	/** Tasks that were in a daily plan of the period: how many are done now. */
	planCompletion: Ratio;
	plannedMinutes: number;
	/** Due-date changes and moved time blocks (replanning). */
	reschedules: number;
	tasksCompleted: number;
	tasksCreated: number;
};

/** State of the task list right now plus the completion streak; independent from the requested period. */
export type Snapshot = {
	/** Open tasks with an unresolved blocker. */
	blocked: number;
	openTasks: number;
	/** Open tasks whose due date is before today. */
	overdue: number;
	/** Consecutive local days (ending today, or yesterday when today has none yet) with at least one completed task; and the longest run in the last year. */
	streak: { current: number; longest: number };
};

export type MetricsSummary = { current: PeriodFigures; previous: PeriodFigures; range: { from: string; to: string; timeZone: string }; snapshot: Snapshot };

const OPEN_STATUSES = ['todo', 'in_progress'] as const;

const periodFigures = async (prisma: Db, ownerId: string, range: Range, query: RangeQuery): Promise<PeriodFigures> => {
	const inPeriod = { gte: range.start, lt: range.end };
	const [tasksCreated, completed, planItems, blocks, reschedules] = await Promise.all([
		prisma.task.count({ where: scoped(ownerId, { createdAt: inPeriod, ...taskWhere(query) }) }),
		prisma.task.findMany({
			select: { completedAt: true, dueDate: true, estimatedMinutes: true, id: true },
			take: ROW_LIMIT,
			where: scoped(ownerId, { completedAt: inPeriod, ...taskWhere(query) }),
		}),
		prisma.dailyPlanItem.findMany({
			select: { task: { select: { status: true } }, taskId: true },
			take: ROW_LIMIT,
			where: scoped(ownerId, { plan: { date: { gte: asDbDate(range.from), lte: asDbDate(range.to) } }, ...viaTask(query) }),
		}),
		prisma.timeBlock.findMany({
			select: { actualEnd: true, actualStart: true, plannedEnd: true, plannedStart: true, status: true },
			take: ROW_LIMIT,
			where: scoped(ownerId, { plannedStart: inPeriod, status: { not: 'rescheduled' as const }, ...viaTask(query) }),
		}),
		prisma.taskEvent.count({ where: scoped(ownerId, { occurredAt: inPeriod, type: { in: ['due_changed', 'rescheduled'] as ('due_changed' | 'rescheduled')[] }, ...viaTask(query) }) }),
	]);

	const withDue = completed.filter(task => task.dueDate);
	const onTime = withDue.filter(task => task.completedAt && localDateOf(task.completedAt, range.timeZone) <= (task.dueDate?.toISOString().slice(0, 10) ?? ''));

	const planned = new Map(planItems.map(item => [item.taskId, item.task.status]));

	const estimated = completed.filter(task => task.estimatedMinutes);
	const doneBlocks = estimated.length
		? await prisma.timeBlock.findMany({
				select: { actualEnd: true, actualStart: true, taskId: true },
				take: ROW_LIMIT,
				where: scoped(ownerId, { status: 'done' as const, taskId: { in: estimated.map(task => task.id) } }),
			})
		: [];
	const actualByTask = new Map<string, number>();
	for (const block of doneBlocks)
		if (block.taskId && block.actualStart && block.actualEnd) actualByTask.set(block.taskId, (actualByTask.get(block.taskId) ?? 0) + minutesBetween(block.actualStart, block.actualEnd));
	const measured = estimated.filter(task => actualByTask.has(task.id));

	return {
		estimates: {
			actualMinutes: measured.reduce((sum, task) => sum + (actualByTask.get(task.id) ?? 0), 0),
			estimatedMinutes: measured.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0),
			tasks: measured.length,
		},
		focusMinutes: blocks.reduce((sum, block) => (block.status === 'done' && block.actualStart && block.actualEnd ? sum + minutesBetween(block.actualStart, block.actualEnd) : sum), 0),
		onTime: ratio(onTime.length, withDue.length),
		planCompletion: ratio([...planned.values()].filter(status => status === 'done').length, planned.size),
		plannedMinutes: blocks.reduce((sum, block) => sum + minutesBetween(block.plannedStart, block.plannedEnd), 0),
		reschedules,
		tasksCompleted: completed.length,
		tasksCreated,
	};
};

/** Streaks from the distinct local days with a completed task, looking back one year from `today`. */
export const computeStreak = (completedDays: Set<string>, today: string): Snapshot['streak'] => {
	let current = 0;
	for (let day = completedDays.has(today) ? today : addDays(today, -1); completedDays.has(day); day = addDays(day, -1)) current += 1;
	let longest = 0;
	let run = 0;
	for (const day of datesBetween(addDays(today, -365), today)) {
		run = completedDays.has(day) ? run + 1 : 0;
		longest = Math.max(longest, run);
	}
	return { current, longest };
};

const snapshot = async (prisma: Db, ownerId: string, range: Range, query: RangeQuery, now: Date): Promise<Snapshot> => {
	const today = localDateOf(now, range.timeZone);
	const open = { in: [...OPEN_STATUSES] };
	const [openTasks, overdue, blocked, completions] = await Promise.all([
		prisma.task.count({ where: scoped(ownerId, { status: open, ...taskWhere(query) }) }),
		prisma.task.count({ where: scoped(ownerId, { dueDate: { lt: asDbDate(today) }, status: open, ...taskWhere(query) }) }),
		prisma.task.count({ where: scoped(ownerId, { blockers: { some: { resolvedAt: null } }, status: open, ...taskWhere(query) }) }),
		prisma.task.findMany({
			select: { completedAt: true },
			take: ROW_LIMIT,
			where: scoped(ownerId, { completedAt: { gte: dayRange(addDays(today, -365), range.timeZone).start }, ...taskWhere(query) }),
		}),
	]);
	const days = new Set(completions.flatMap(task => (task.completedAt ? [localDateOf(task.completedAt, range.timeZone)] : [])));
	return { blocked, openTasks, overdue, streak: computeStreak(days, today) };
};

/** Card metrics for the period and the previous period of the same length, plus the current snapshot, optionally narrowed by project, goal, tag or priority. Everything is computed on read. */
export const getSummary = async (prisma: Db, ownerId: string, query: RangeQuery, now: Date = new Date()): Promise<MetricsSummary> => {
	const range = await resolveRange(prisma, ownerId, query, now);
	const [current, previous, state] = await Promise.all([
		periodFigures(prisma, ownerId, range, query),
		periodFigures(prisma, ownerId, previousRange(range), query),
		snapshot(prisma, ownerId, range, query, now),
	]);
	return { current, previous, range: { from: range.from, timeZone: range.timeZone, to: range.to }, snapshot: state };
};
