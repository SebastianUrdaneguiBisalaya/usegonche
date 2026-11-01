import type { PrismaClient } from '@usegonche/database';
import { scoped } from '../../lib/owner.js';
import { dayRange, localDateOf } from '../../lib/time.js';
import { availabilityIntervals, busyIntervals, minutesOf, subtract, toInterval } from '../planning/planning.intervals.js';
import { CLOSED_TASK, getTimeZone, getWindows } from '../planning/planning.shared.js';
import { type Candidate, rank, type Suggestion } from './suggestions.ranking.js';

export type NextSuggestions = {
	date: string;
	/** Tasks left out and why, so a missing task is never a mystery. */
	excluded: { blocked: number; notStarted: number };
	/** Time left on `date` (from now if it is today): working hours minus events and planned blocks. */
	freeMinutes: number;
	largestFreeSlotMinutes: number;
	suggestions: Suggestion[];
	timezone: string;
};

const MAX_CANDIDATES = 1000;
const goalIsLive = (goal: { archivedAt: Date | null; status: string } | null | undefined): boolean => Boolean(goal && !goal.archivedAt && goal.status === 'active');

/**
 * What to work on next on `date` (default: today in the user's timezone). Read-only: it never changes data.
 * Candidates are open tasks; those waiting on an unfinished dependency or an open blocker, those whose start date is still ahead, and
 * parents that still have open subtasks (their subtasks are suggested instead) are left out. The rest is ranked by `rank`.
 */
export const suggestNext = async (prisma: PrismaClient, ownerId: string, date: string | undefined, limit: number, now: Date = new Date()): Promise<NextSuggestions> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	const day = date ?? localDateOf(now, timeZone);
	const range = dayRange(day, timeZone);
	const freeFrom = Math.max(range.start.getTime(), now.getTime());

	const [tasks, plannedToday, windows, events, blocks] = await Promise.all([
		prisma.task.findMany({
			include: {
				blockers: { select: { id: true }, where: { resolvedAt: null } },
				dependencies: { select: { dependsOn: { select: { status: true } } } },
				goal: { select: { archivedAt: true, status: true } },
				project: { select: { goal: { select: { archivedAt: true, status: true } }, goalId: true } },
				subtasks: { select: { status: true } },
			},
			orderBy: { id: 'asc' },
			take: MAX_CANDIDATES,
			where: scoped(ownerId, { status: { in: ['todo', 'in_progress'] as ('in_progress' | 'todo')[] } }),
		}),
		prisma.dailyPlanItem.findMany({ select: { taskId: true }, where: scoped(ownerId, { plan: { date: new Date(day) } }) }),
		getWindows(prisma, ownerId),
		prisma.calendarEvent.findMany({ where: scoped(ownerId, { endsAt: { gt: new Date(freeFrom) }, startsAt: { lt: range.end } }) }),
		prisma.timeBlock.findMany({
			select: { plannedEnd: true, plannedStart: true },
			where: scoped(ownerId, { plannedEnd: { gt: new Date(freeFrom) }, plannedStart: { lt: range.end }, status: 'planned' as const }),
		}),
	]);

	const free = subtract(subtract(availabilityIntervals(windows, day, day, timeZone), [{ end: freeFrom, start: Number.NEGATIVE_INFINITY }]), [
		...busyIntervals(events),
		...blocks.map(block => toInterval(block.plannedStart, block.plannedEnd)),
	]);
	const largestFreeSlotMinutes = Math.max(0, ...free.map(interval => minutesOf([interval])));
	const planned = new Set(plannedToday.map(item => item.taskId));
	const today = new Date(day);

	let blocked = 0;
	let notStarted = 0;
	const candidates: Candidate[] = [];
	for (const task of tasks) {
		if (task.subtasks.some(subtask => !(CLOSED_TASK as readonly string[]).includes(subtask.status))) continue;
		if (task.blockers.length > 0 || task.dependencies.some(dependency => !(CLOSED_TASK as readonly string[]).includes(dependency.dependsOn.status))) {
			blocked += 1;
			continue;
		}
		if (task.startDate && task.startDate > today) {
			notStarted += 1;
			continue;
		}
		// Effective goal: the task's own goal, else its project's; it only counts while that goal is active and not archived.
		const goalId = task.goalId ? (goalIsLive(task.goal) ? task.goalId : null) : goalIsLive(task.project?.goal) ? (task.project?.goalId ?? null) : null;
		candidates.push({
			createdAt: task.createdAt,
			dueDate: task.dueDate,
			estimatedMinutes: task.estimatedMinutes,
			goalId,
			id: task.id,
			inPlanToday: planned.has(task.id),
			priority: task.priority,
			projectId: task.projectId,
			released: task.dependencies.length > 0,
			startDate: task.startDate,
			status: task.status as 'in_progress' | 'todo',
			title: task.title,
		});
	}

	return {
		date: day,
		excluded: { blocked, notStarted },
		freeMinutes: minutesOf(free),
		largestFreeSlotMinutes,
		suggestions: rank(candidates, { largestFreeSlotMinutes, today }, limit),
		timezone: timeZone,
	};
};
