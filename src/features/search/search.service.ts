import { Prisma, type PrismaClient } from '@usegonche/database';
import { type Paged, type PageParams, pageArgs } from '../../lib/pagination.js';
import { SEARCH_TYPES, type SearchType } from './search.schemas.js';

/**
 * One hit. `snippet` is plain text from the Markdown (or the item content) with the matched words wrapped in `«` and `»`;
 * clients render it as text, never as HTML.
 */
export type SearchResult = { id: string; snippet: string; title: string; type: SearchType; updatedAt: Date };

/** Where each type lives. Names are constants (never user input), so they are safe to inline as raw SQL. */
const SOURCES: Record<SearchType, { table: string; text: string; title: string }> = {
	goal: { table: 'goals', text: 'description', title: 's.title' },
	inbox: { table: 'inbox_items', text: 'content', title: 'left(s.content, 200)' },
	note: { table: 'notes', text: 'body', title: 's.title' },
	project: { table: 'projects', text: 'description', title: 's.title' },
	task: { table: 'tasks', text: 'description', title: 's.title' },
};

const HEADLINE_OPTIONS = 'StartSel=«, StopSel=», MaxFragments=1, MaxWords=25, MinWords=10';

type Row = { id: string; snippet: string; title: string; type: SearchType; updated_at: Date };

/**
 * Full-text search across the owner's tasks, notes, projects, goals and inbox items (`websearch_to_tsquery`, config `simple`,
 * matched against the generated `search_vector` columns). Newest first by `updated_at` with `id` as tie-breaker, one page at a
 * time (offset pagination like every list) plus the total of matches. Always filtered by owner.
 */
export const search = async (prisma: PrismaClient, ownerId: string, q: string, types: SearchType[] | undefined, page: PageParams): Promise<Paged<SearchResult>> => {
	const { skip, take } = pageArgs(page);
	const sources = (types?.length ? types : SEARCH_TYPES).map(type => ({ type, ...SOURCES[type] }));
	const selected = sources.map(({ table, text, title, type }) => {
		const t = Prisma.raw(table);
		// Each branch keeps only the rows up to the end of this page (before ts_headline runs) so no more rows than needed are highlighted.
		return Prisma.sql`SELECT * FROM (
			SELECT ${type}::text AS type, s.id, ${Prisma.raw(title)} AS title, s.updated_at,
				ts_headline('simple', coalesce(s.${Prisma.raw(text)}, ''), query.q, ${HEADLINE_OPTIONS}) AS snippet
			FROM ${t} s, (SELECT websearch_to_tsquery('simple', ${q}) AS q) query
			WHERE s.owner_id = ${ownerId}::uuid AND s.search_vector @@ query.q
			ORDER BY s.updated_at DESC, s.id DESC
			LIMIT ${skip + take}
		) ${Prisma.raw(`${type}_hits`)}`;
	});
	const counted = sources.map(
		({ table }) => Prisma.sql`SELECT count(*)::int AS n FROM ${Prisma.raw(table)} s WHERE s.owner_id = ${ownerId}::uuid AND s.search_vector @@ websearch_to_tsquery('simple', ${q})`
	);
	const [rows, totals] = await Promise.all([
		prisma.$queryRaw<Row[]>(Prisma.sql`${Prisma.join(selected, ' UNION ALL ')} ORDER BY updated_at DESC, id DESC LIMIT ${take} OFFSET ${skip}`),
		prisma.$queryRaw<{ n: number }[]>(Prisma.sql`${Prisma.join(counted, ' UNION ALL ')}`),
	]);
	return { items: rows.map(({ updated_at, ...row }) => ({ ...row, updatedAt: updated_at })), total: totals.reduce((sum, row) => sum + row.n, 0) };
};
