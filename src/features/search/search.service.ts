import { Prisma, type PrismaClient } from '@usegonche/database';
import type { Cursor } from '../../lib/pagination.js';
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
 * matched against the generated `search_vector` columns). Newest first by `updated_at` with `id` as tie-breaker (keyset
 * pagination like every list), so it fetches one row beyond `limit`. Always filtered by owner.
 */
export const search = async (prisma: PrismaClient, ownerId: string, q: string, types: SearchType[] | undefined, limit: number, cursor?: Cursor): Promise<SearchResult[]> => {
	const after = cursor ? Prisma.sql`AND (s.updated_at < ${cursor.at} OR (s.updated_at = ${cursor.at} AND s.id < ${cursor.id}::uuid))` : Prisma.empty;
	const selected = (types?.length ? types : SEARCH_TYPES).map(type => {
		const { table, text, title } = SOURCES[type];
		const t = Prisma.raw(table);
		// Limit inside each branch (before ts_headline runs) so only the rows of this page are highlighted.
		return Prisma.sql`SELECT * FROM (
			SELECT ${type}::text AS type, s.id, ${Prisma.raw(title)} AS title, s.updated_at,
				ts_headline('simple', coalesce(s.${Prisma.raw(text)}, ''), query.q, ${HEADLINE_OPTIONS}) AS snippet
			FROM ${t} s, (SELECT websearch_to_tsquery('simple', ${q}) AS q) query
			WHERE s.owner_id = ${ownerId}::uuid AND s.search_vector @@ query.q ${after}
			ORDER BY s.updated_at DESC, s.id DESC
			LIMIT ${limit + 1}
		) ${Prisma.raw(`${type}_hits`)}`;
	});
	const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`${Prisma.join(selected, ' UNION ALL ')} ORDER BY updated_at DESC, id DESC LIMIT ${limit + 1}`);
	return rows.map(({ updated_at, ...row }) => ({ ...row, updatedAt: updated_at }));
};
