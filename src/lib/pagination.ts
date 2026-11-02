import { z } from 'zod';

/**
 * Offset pagination for every list endpoint (`?page=<n>&pageSize=<n>`, 1-based pages), so tables can show page numbers and a total.
 * Lists stay ordered by a timestamp descending with `id` as tie-breaker, which keeps the order total and pages from overlapping.
 *
 * Usage in a feature:
 *   query:   z.object({ ...paginationQuery, ...filters })
 *   service: const [items, total] = await Promise.all([findMany({ orderBy: pageOrder('<timestampField>'), ...pageArgs(page), where }), count({ where })]); return { items, total }
 *   route:   const { items, total } = await listX(...); return okWithMeta(c, items, pageMeta(page, total), 200)
 */

export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 100;

export type PageParams = { page: number; pageSize: number };
export type Paged<T> = { items: T[]; total: number };
export type PageMeta = { page: number; pageCount: number; pageSize: number; total: number };

/** Spread into a feature's query schema: `z.object({ ...paginationQuery, status })`. */
export const paginationQuery = {
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
};

/** Ordering that keeps pages stable: the timestamp field, then id, both descending. */
export const pageOrder = <F extends string>(field: F) => [{ [field]: 'desc' } as { [K in F]: 'desc' }, { id: 'desc' as const }];

/** Prisma `skip`/`take` for a page. */
export const pageArgs = ({ page, pageSize }: PageParams): { skip: number; take: number } => ({ skip: (page - 1) * pageSize, take: pageSize });

/** `meta` of a paginated response. `pageCount` is at least 1 so an empty list still has a first page. */
export const pageMeta = ({ page, pageSize }: PageParams, total: number): PageMeta => ({ page, pageCount: Math.max(1, Math.ceil(total / pageSize)), pageSize, total });
