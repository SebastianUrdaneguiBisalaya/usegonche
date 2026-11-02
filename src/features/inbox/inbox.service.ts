import type { InboxItem, InboxStatus, Prisma, PrismaClient } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';
import { INBOX_STATUSES, type InboxRange, RANGE_HOURS, type UserStatus } from './inbox.schemas.js';

/** Anything with the Prisma model API, so the same functions run inside `prisma.$transaction(tx => ...)`. */
type Db = PrismaClient | Prisma.TransactionClient;

export const captureItem = (prisma: Db, ownerId: string, content: string): Promise<InboxItem> => prisma.inboxItem.create({ data: { content, ownerId, source: 'quick' } });

/** One item per line, all captured in a single write. */
export const brainDump = (prisma: Db, ownerId: string, lines: string[]): Promise<InboxItem[]> =>
	prisma.inboxItem.createManyAndReturn({ data: lines.map(content => ({ content, ownerId, source: 'braindump' as const })) });

export type InboxCounts = Record<InboxStatus, number>;
export type InboxPage = { counts: InboxCounts; items: InboxItem[]; total: number };

/** Start of the range as an instant (rolling window back from `now`), or `undefined` for all time. */
const rangeStart = (range: InboxRange, now: Date): Date | undefined => {
	const hours = RANGE_HOURS[range];
	return hours === undefined ? undefined : new Date(now.getTime() - hours * 3_600_000);
};

/**
 * One page of the items in `status` (newest first) within the range, plus the number of items per status in that same range
 * (the counters of the status tabs). `total` is the count of the requested status.
 */
export const listItems = async (prisma: Db, ownerId: string, status: InboxStatus, range: InboxRange, page: PageParams, now: Date = new Date()): Promise<InboxPage> => {
	const start = rangeStart(range, now);
	const inRange = start ? { capturedAt: { gte: start } } : {};
	const where = scoped(ownerId, { status, ...inRange });
	const [items, grouped] = await Promise.all([
		prisma.inboxItem.findMany({ orderBy: pageOrder('capturedAt'), ...pageArgs(page), where }),
		prisma.inboxItem.groupBy({ _count: { _all: true }, by: ['status'], where: scoped(ownerId, inRange) }),
	]);
	const counts = Object.fromEntries(INBOX_STATUSES.map(name => [name, 0])) as InboxCounts;
	for (const row of grouped) counts[row.status] = row._count._all;
	return { counts, items, total: counts[status] };
};

/** Why a conditional update touched nothing: the item is not the owner's (404) or it is in the wrong state (409). */
const explainNoMatch = async (prisma: Db, ownerId: string, id: string): Promise<never> => {
	const exists = await prisma.inboxItem.findFirst({ select: { id: true }, where: scoped(ownerId, { id }) });
	throw exists ? new AppError('invalid_state', 409) : new AppError('not_found', 404);
};

const findOwned = async (prisma: Db, ownerId: string, id: string): Promise<InboxItem> => {
	const item = await prisma.inboxItem.findFirst({ where: scoped(ownerId, { id }) });
	if (!item) throw new AppError('not_found', 404);
	return item;
};

/**
 * Archive, discard or restore (back to pending). Converted items are terminal (409). Setting the current status again is a no-op.
 * `processedAt` is set when the item leaves `pending` and cleared when it is restored.
 */
export const setStatus = async (prisma: Db, ownerId: string, id: string, status: UserStatus): Promise<InboxItem> => {
	const { count } = await prisma.inboxItem.updateMany({
		data: { processedAt: status === 'pending' ? null : new Date(), status },
		where: scoped(ownerId, { id, status: { not: 'converted' as const } }),
	});
	if (count === 0) return explainNoMatch(prisma, ownerId, id);
	return findOwned(prisma, ownerId, id);
};

/**
 * Marks a pending item as converted. Called by the task, project and note services inside the same transaction that
 * creates the target (which stores `origin_inbox_item_id`), so conversion is atomic and the item is never lost.
 */
export const markConverted = async (prisma: Db, ownerId: string, id: string): Promise<void> => {
	const { count } = await prisma.inboxItem.updateMany({ data: { processedAt: new Date(), status: 'converted' }, where: scoped(ownerId, { id, status: 'pending' as const }) });
	if (count === 0) await explainNoMatch(prisma, ownerId, id);
};
