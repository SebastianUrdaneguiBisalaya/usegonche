import type { Prisma, PrismaClient, TaskPriority, TaskStatus } from '@usegonche/database';
import { scoped } from '../../lib/owner.js';
import { addDays, dayRange } from '../../lib/time.js';
import { CLOSED_TASK, getTimeZone } from '../planning/planning.shared.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type TaskBrief = { dueDate: Date | null; id: string; priority: TaskPriority; status: TaskStatus; title: string };

export type RecurringBlocker = {
	/** How many times a blocker with this reason started in the lookback window (the period plus the 90 days before it). */
	occurrences: number;
	/** Reason as first written; blockers are grouped ignoring case and surrounding spaces. */
	reason: string;
	startedAt: Date;
	stillOpen: number;
};

export type ChangeBrief = { from: string | null; id: string; occurredAt: Date; task: { id: string; title: string }; to: string | null; type: 'due_changed' | 'priority_changed' };

/** Everything the review shows, computed from real data. The four counters are what `close` snapshots. */
export type Prefill = {
	/** Priority and due-date changes made during the period. */
	changes: ChangeBrief[];
	/** Tasks completed during the period (planned or not). */
	completed: TaskBrief[];
	counters: { actualMinutes: number; completedTasks: number; plannedMinutes: number; plannedTasks: number };
	/** Time blocks of the period that ended `missed`. */
	missedBlocks: number;
	/** Tasks that were in a daily plan of the period and are still open: these are the carry-over candidates. */
	pending: TaskBrief[];
	/** Blocker reasons that keep coming back, most frequent first. */
	recurringBlockers: RecurringBlocker[];
};

const BLOCKER_LOOKBACK_DAYS = 90;
const MINUTE_MS = 60_000;
const taskSelect = { dueDate: true, id: true, priority: true, status: true, title: true } as const;

const minutes = (start: Date, end: Date): number => Math.max(0, Math.round((end.getTime() - start.getTime()) / MINUTE_MS));
const day = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

/** Prefill for the local dates `periodStart`..`periodEnd` (inclusive) in the user's timezone. */
export const computePrefill = async (prisma: Db, ownerId: string, periodStart: string, periodEnd: string): Promise<Prefill> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	const start = dayRange(periodStart, timeZone).start;
	const end = dayRange(periodEnd, timeZone).end;
	const lookback = dayRange(addDays(periodEnd, -BLOCKER_LOOKBACK_DAYS), timeZone).start;

	const [planItems, completed, blocks, blockers, events] = await Promise.all([
		prisma.dailyPlanItem.findMany({
			include: { task: { select: taskSelect } },
			orderBy: { createdAt: 'asc' },
			where: scoped(ownerId, { plan: { date: { gte: new Date(periodStart), lte: new Date(periodEnd) } } }),
		}),
		prisma.task.findMany({ orderBy: { completedAt: 'asc' }, select: taskSelect, take: 200, where: scoped(ownerId, { completedAt: { gte: start, lt: end } }) }),
		prisma.timeBlock.findMany({
			select: { actualEnd: true, actualStart: true, plannedEnd: true, plannedStart: true, status: true },
			where: scoped(ownerId, { plannedStart: { gte: start, lt: end }, status: { not: 'rescheduled' as const } }),
		}),
		prisma.taskBlocker.findMany({
			orderBy: { startedAt: 'asc' },
			select: { reason: true, resolvedAt: true, startedAt: true },
			take: 500,
			where: scoped(ownerId, { startedAt: { gte: lookback, lt: end } }),
		}),
		prisma.taskEvent.findMany({
			include: { task: { select: { id: true, title: true } } },
			orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
			take: 100,
			where: scoped(ownerId, { occurredAt: { gte: start, lt: end }, type: { in: ['priority_changed', 'due_changed'] as ('due_changed' | 'priority_changed')[] } }),
		}),
	]);

	const planned = new Map<string, TaskBrief>();
	for (const item of planItems) planned.set(item.task.id, item.task);
	const pending = [...planned.values()].filter(task => !(CLOSED_TASK as readonly string[]).includes(task.status));

	const groups = new Map<string, RecurringBlocker>();
	for (const blocker of blockers) {
		const key = blocker.reason.trim().toLowerCase();
		const group = groups.get(key) ?? { occurrences: 0, reason: blocker.reason.trim(), startedAt: blocker.startedAt, stillOpen: 0 };
		group.occurrences += 1;
		group.startedAt = blocker.startedAt;
		if (!blocker.resolvedAt) group.stillOpen += 1;
		groups.set(key, group);
	}
	// "Recurring" = seen at least twice, and at least once during this period.
	const recurringBlockers = [...groups.values()]
		.filter(group => group.occurrences >= 2 && group.startedAt >= start)
		.sort((a, b) => b.occurrences - a.occurrences || a.reason.localeCompare(b.reason));

	return {
		changes: events.map(event => ({
			from: event.type === 'due_changed' ? day(event.fromDueDate) : event.fromPriority,
			id: event.id,
			occurredAt: event.occurredAt,
			task: event.task,
			to: event.type === 'due_changed' ? day(event.toDueDate) : event.toPriority,
			type: event.type as 'due_changed' | 'priority_changed',
		})),
		completed,
		counters: {
			actualMinutes: blocks.reduce((total, block) => total + (block.actualStart && block.actualEnd ? minutes(block.actualStart, block.actualEnd) : 0), 0),
			completedTasks: completed.length,
			plannedMinutes: blocks.reduce((total, block) => total + minutes(block.plannedStart, block.plannedEnd), 0),
			plannedTasks: planned.size,
		},
		missedBlocks: blocks.filter(block => block.status === 'missed').length,
		pending,
		recurringBlockers,
	};
};
