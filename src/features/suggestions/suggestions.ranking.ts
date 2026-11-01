import type { TaskPriority } from '@usegonche/database';

/**
 * Explainable ranking. Every candidate gets reason codes; the order comes from the weights below and is never stored or exposed
 * as a score. Pure and deterministic: same inputs, same output (ties break by due date, priority, creation time, then id).
 */

export type ReasonCode = 'due_soon' | 'due_today' | 'fits_available_slot' | 'in_progress' | 'linked_to_goal' | 'overdue' | 'planned_today' | 'priority_high' | 'priority_urgent' | 'unblocked';

/** `value` is the number the reason is about: days overdue / days until due, or the estimate in minutes for `fits_available_slot`. */
export type Reason = { code: ReasonCode; value?: number };

export const WEIGHTS = {
	dueSoon: 50,
	dueToday: 80,
	fitsSlot: 10,
	inProgress: 20,
	linkedToGoal: 10,
	overdue: 100,
	/** Extra points per day overdue, capped at `OVERDUE_DAYS_CAP`. */
	overduePerDay: 1,
	plannedToday: 30,
	priority: { high: 25, low: 0, medium: 10, urgent: 40 } satisfies Record<TaskPriority, number>,
	unblocked: 15,
} as const;
export const OVERDUE_DAYS_CAP = 10;
/** A task due within this many days (after today) counts as "due soon". */
export const DUE_SOON_DAYS = 3;

export type Candidate = {
	createdAt: Date;
	dueDate: Date | null;
	estimatedMinutes: number | null;
	/** Effective goal: the task's own goal, else its project's. Only set when that goal is active and not archived. */
	goalId: string | null;
	id: string;
	inPlanToday: boolean;
	priority: TaskPriority;
	projectId: string | null;
	/** Had dependencies and every one of them is finished. */
	released: boolean;
	startDate: Date | null;
	status: 'in_progress' | 'todo';
	title: string;
};

export type Context = {
	/** Minutes of the longest free stretch left in the day (working hours minus events and planned blocks, from now). */
	largestFreeSlotMinutes: number;
	/** Today as a UTC-midnight date. */
	today: Date;
};

export type Suggestion = { rank: number; reasons: Reason[]; task: Omit<Candidate, 'inPlanToday' | 'released'> };

const DAY_MS = 86_400_000;

const daysBetween = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** Reasons and the weight they add up to for one candidate. */
export const explain = (candidate: Candidate, context: Context): { points: number; reasons: Reason[] } => {
	const reasons: Reason[] = [];
	let points = 0;
	const add = (reason: Reason, weight: number) => {
		reasons.push(reason);
		points += weight;
	};

	if (candidate.dueDate) {
		const days = daysBetween(context.today, candidate.dueDate);
		if (days < 0) add({ code: 'overdue', value: -days }, WEIGHTS.overdue + Math.min(-days, OVERDUE_DAYS_CAP) * WEIGHTS.overduePerDay);
		else if (days === 0) add({ code: 'due_today', value: 0 }, WEIGHTS.dueToday);
		else if (days <= DUE_SOON_DAYS) add({ code: 'due_soon', value: days }, WEIGHTS.dueSoon);
	}
	if (candidate.priority === 'urgent') add({ code: 'priority_urgent' }, WEIGHTS.priority.urgent);
	else if (candidate.priority === 'high') add({ code: 'priority_high' }, WEIGHTS.priority.high);
	else points += WEIGHTS.priority[candidate.priority];
	if (candidate.inPlanToday) add({ code: 'planned_today' }, WEIGHTS.plannedToday);
	if (candidate.status === 'in_progress') add({ code: 'in_progress' }, WEIGHTS.inProgress);
	if (candidate.released) add({ code: 'unblocked' }, WEIGHTS.unblocked);
	if (candidate.estimatedMinutes !== null && candidate.estimatedMinutes <= context.largestFreeSlotMinutes) add({ code: 'fits_available_slot', value: candidate.estimatedMinutes }, WEIGHTS.fitsSlot);
	if (candidate.goalId) add({ code: 'linked_to_goal' }, WEIGHTS.linkedToGoal);
	return { points, reasons };
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 1, low: 3, medium: 2, urgent: 0 };

/** Ranks the candidates best first and keeps `limit`. */
export const rank = (candidates: Candidate[], context: Context, limit: number): Suggestion[] =>
	candidates
		.map(candidate => ({ candidate, ...explain(candidate, context) }))
		.sort(
			(a, b) =>
				b.points - a.points ||
				(a.candidate.dueDate?.getTime() ?? Number.POSITIVE_INFINITY) - (b.candidate.dueDate?.getTime() ?? Number.POSITIVE_INFINITY) ||
				PRIORITY_ORDER[a.candidate.priority] - PRIORITY_ORDER[b.candidate.priority] ||
				a.candidate.createdAt.getTime() - b.candidate.createdAt.getTime() ||
				a.candidate.id.localeCompare(b.candidate.id)
		)
		.slice(0, limit)
		.map(({ candidate, reasons }, index) => {
			const { inPlanToday: _plan, released: _released, ...task } = candidate;
			return { rank: index + 1, reasons, task };
		});
