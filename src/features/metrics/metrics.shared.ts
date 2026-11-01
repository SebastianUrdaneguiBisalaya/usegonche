import type { Prisma, PrismaClient } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { addDays, dayRange, daysBetween, localDateOf } from '../../lib/time.js';
import { getTimeZone } from '../planning/planning.shared.js';

export type Db = PrismaClient | Prisma.TransactionClient;

/** Longest range a metrics request can cover, in days (inclusive). */
export const MAX_RANGE_DAYS = 366;
/** Default range when `from` is not given: the last 30 days. */
export const DEFAULT_RANGE_DAYS = 30;
/** Upper bound of rows read per query. The data is personal, so this is far above real usage; it only protects the API. */
export const ROW_LIMIT = 5000;
export const MINUTE_MS = 60_000;

/** Optional filters on the tasks behind every metric. Time blocks, plan items, blockers and events are filtered through their task. */
export type TaskFilters = { goalId?: string; priority?: 'low' | 'medium' | 'high' | 'urgent'; projectId?: string; tagId?: string };

export const taskWhere = ({ goalId, priority, projectId, tagId }: TaskFilters): Prisma.TaskWhereInput => ({
	...(goalId && { goalId }),
	...(priority && { priority }),
	...(projectId && { projectId }),
	...(tagId && { tags: { some: { tagId } } }),
});

/** `{ task: ... }` for models that belong to a task; empty without filters, so time blocks without a task are only left out when filtering. */
export const viaTask = (filters: TaskFilters): { task?: Prisma.TaskWhereInput } => (Object.keys(taskWhere(filters)).length > 0 ? { task: taskWhere(filters) } : {});

/** `from`..`to` are local dates (inclusive); `start`..`end` are the matching instants (`end` exclusive) in the user's timezone. */
export type Range = { end: Date; from: string; start: Date; timeZone: string; to: string };

/** A figure with the counts it comes from, so it is always explainable. `rate` is `done / total`, `null` when there is nothing to divide. */
export type Ratio = { done: number; rate: number | null; total: number };

export const ratio = (done: number, total: number): Ratio => ({ done, rate: total > 0 ? Math.round((done / total) * 1000) / 1000 : null, total });

export const minutesBetween = (start: Date, end: Date): number => Math.max(0, Math.round((end.getTime() - start.getTime()) / MINUTE_MS));

/** A local date as the UTC-midnight `Date` that `@db.Date` columns use. */
export const asDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`);

const rangeError = (code: string): AppError => new AppError('validation_error', 422, [{ code, field: 'from' }]);

/** Resolves optional `from`/`to` (default: the last 30 days up to today) in the user's timezone. 422 when reversed or longer than 366 days. */
export const resolveRange = async (prisma: Db, ownerId: string, query: { from?: string; to?: string }, now: Date = new Date()): Promise<Range> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	const to = query.to ?? localDateOf(now, timeZone);
	const from = query.from ?? addDays(to, 1 - DEFAULT_RANGE_DAYS);
	if (from > to) throw rangeError('from_after_to');
	if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) throw rangeError('range_too_large');
	return { end: dayRange(to, timeZone).end, from, start: dayRange(from, timeZone).start, timeZone, to };
};

/** The range of the same length that ends the day before `range` starts (to compare a period with the previous one). */
export const previousRange = (range: Range): Range => {
	const length = daysBetween(range.from, range.to) + 1;
	const to = addDays(range.from, -1);
	const from = addDays(to, 1 - length);
	return { end: range.start, from, start: dayRange(from, range.timeZone).start, timeZone: range.timeZone, to };
};
