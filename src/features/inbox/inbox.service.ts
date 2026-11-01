import type { InboxItem, InboxStatus, Prisma, PrismaClient } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Cursor, keysetAfter, keysetOrder } from '../../lib/pagination.js';
import type { UserStatus } from './inbox.schemas.js';

/** Anything with the Prisma model API, so the same functions run inside `prisma.$transaction(tx => ...)`. */
type Db = PrismaClient | Prisma.TransactionClient;

export const captureItem = (prisma: Db, ownerId: string, content: string): Promise<InboxItem> => prisma.inboxItem.create({ data: { content, ownerId, source: 'quick' } });

/** One item per line, all captured in a single write. */
export const brainDump = (prisma: Db, ownerId: string, lines: string[]): Promise<InboxItem[]> =>
	prisma.inboxItem.createManyAndReturn({ data: lines.map(content => ({ content, ownerId, source: 'braindump' as const })) });

/** Fetches `limit + 1` rows after `cursor` (newest first); pass them to `toPage` to get the page and `nextCursor`. */
export const listItems = (prisma: Db, ownerId: string, status: InboxStatus, limit: number, cursor?: Cursor): Promise<InboxItem[]> =>
	prisma.inboxItem.findMany({ orderBy: keysetOrder('capturedAt'), take: limit + 1, where: { ...scoped(ownerId, { status }), ...keysetAfter('capturedAt', cursor) } });

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
