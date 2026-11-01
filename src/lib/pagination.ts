import { z } from 'zod';

/**
 * Keyset (cursor) pagination for lists ordered by a timestamp, newest first, with `id` as tie-breaker.
 * Stable under inserts and deletes (unlike offset) and uses the `(owner_id, ..., <timestamp>)` index.
 *
 * Usage in a feature:
 *   query:   z.object({ ...paginationQuery, status: ... })
 *   service: findMany({ orderBy: keysetOrder('capturedAt'), take: limit + 1, where: { ...scoped(ownerId, filters), ...keysetAfter('capturedAt', cursor) } })
 *   route:   const { items, nextCursor } = toPage(rows, limit, row => row.capturedAt); okWithMeta(c, items, { limit, nextCursor })
 *
 * The cursor is opaque to clients: they only echo back `meta.nextCursor` as `?cursor=`.
 */

export const LIMIT_DEFAULT = 50;
export const LIMIT_MAX = 100;

export type Cursor = { at: Date; id: string };

const SEPARATOR = '|';

const toBase64Url = (value: string): string => btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const fromBase64Url = (value: string): string => atob(value.replaceAll('-', '+').replaceAll('_', '/'));

export const encodeCursor = ({ at, id }: Cursor): string => toBase64Url(`${at.toISOString()}${SEPARATOR}${id}`);

/** Returns `null` for anything that is not a cursor produced by `encodeCursor`. */
export const decodeCursor = (value: string): Cursor | null => {
	try {
		const [iso, id, ...rest] = fromBase64Url(value).split(SEPARATOR);
		if (!iso || !id || rest.length > 0) return null;
		const at = new Date(iso);
		if (Number.isNaN(at.getTime()) || at.toISOString() !== iso || !z.uuid().safeParse(id).success) return null;
		return { at, id };
	} catch {
		return null;
	}
};

/** Validated `?cursor=`: an invalid value fails validation (422) instead of silently restarting the list. */
export const cursorSchema = z
	.string()
	.max(200)
	.transform((value, ctx) => {
		const cursor = decodeCursor(value);
		if (!cursor) ctx.addIssue({ code: 'custom', message: 'invalid_cursor' });
		return cursor ?? z.NEVER;
	});

/** Spread into a feature's query schema: `z.object({ ...paginationQuery, status })`. */
export const paginationQuery = {
	cursor: cursorSchema.optional(),
	limit: z.coerce.number().int().min(1).max(LIMIT_MAX).default(LIMIT_DEFAULT),
};

/** Ordering that matches `keysetAfter`. */
export const keysetOrder = <F extends string>(field: F) => [{ [field]: 'desc' } as { [K in F]: 'desc' }, { id: 'desc' as const }];

/** Prisma `where` fragment selecting the rows after `cursor` (older than it) for the given timestamp field. */
export const keysetAfter = <F extends string>(field: F, cursor: Cursor | undefined) =>
	cursor ? ({ OR: [{ [field]: { lt: cursor.at } }, { [field]: cursor.at, id: { lt: cursor.id } }] } as { OR: [{ [K in F]: { lt: Date } }, { [K in F]: Date } & { id: { lt: string } }] }) : {};

/** Turns `limit + 1` fetched rows into a page: drops the extra row and builds `nextCursor` from the last kept one. */
export const toPage = <T extends { id: string }>(rows: T[], limit: number, timestampOf: (row: T) => Date): { items: T[]; nextCursor: string | null } => {
	const items = rows.slice(0, limit);
	const last = items.at(-1);
	return { items, nextCursor: rows.length > limit && last ? encodeCursor({ at: timestampOf(last), id: last.id }) : null };
};
