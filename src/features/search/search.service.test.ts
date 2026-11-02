import type { PrismaClient } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { search } from './search.service.js';

const NOW = new Date('2026-11-02T10:00:00Z');
const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const FIRST = { page: 1, pageSize: 10 };

/** First call is the page of hits, second the per-type match counts. */
const setup = (rows: unknown[] = [], counts: { n: number }[] = [{ n: 0 }]) => {
	const $queryRaw = vi.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce(counts);
	return { $queryRaw, prisma: { $queryRaw } as unknown as PrismaClient };
};
const queryOf = ($queryRaw: ReturnType<typeof vi.fn>, call = 0) => $queryRaw.mock.calls[call]?.[0] as { sql: string; values: unknown[] };

describe('search', () => {
	it('maps rows to results with camelCase dates and sums the match counts', async () => {
		const { prisma } = setup([{ id: ID, snippet: 'fix «bug»', title: 'Fix', type: 'task', updated_at: NOW }], [{ n: 2 }, { n: 3 }]);
		expect(await search(prisma, TEST_USER_ID, 'bug', undefined, FIRST)).toEqual({ items: [{ id: ID, snippet: 'fix «bug»', title: 'Fix', type: 'task', updatedAt: NOW }], total: 5 });
	});

	it('searches every type by default, scoped by owner, with the query and the page window as parameters', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, 'my "exact phrase"', undefined, { page: 3, pageSize: 20 });
		const { sql, values } = queryOf($queryRaw);
		for (const table of ['tasks', 'notes', 'projects', 'goals', 'inbox_items']) expect(sql).toContain(`FROM ${table} s`);
		expect(sql.match(/s\.owner_id = /g)).toHaveLength(5);
		expect(sql).toContain('websearch_to_tsquery');
		expect(sql).toContain('OFFSET');
		expect(values).toContain(TEST_USER_ID);
		expect(values).toContain('my "exact phrase"');
		// Each branch keeps skip + take rows (40 + 20); the outer query takes 20 after skipping 40.
		expect(values).toContain(60);
		expect(values).toContain(20);
		expect(values).toContain(40);
		expect(values).not.toContain(OTHER_USER_ID);
	});

	it('counts the matches of every type with the same owner scope', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, 'x', undefined, FIRST);
		const { sql, values } = queryOf($queryRaw, 1);
		expect(sql.match(/count\(\*\)/g)).toHaveLength(5);
		expect(sql.match(/s\.owner_id = /g)).toHaveLength(5);
		expect(values).toContain(TEST_USER_ID);
	});

	it('never inlines user input into the SQL text', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, "'; DROP TABLE tasks; --", ['task'], FIRST);
		expect(queryOf($queryRaw).sql).not.toContain('DROP');
		expect(queryOf($queryRaw, 1).sql).not.toContain('DROP');
	});

	it('restricts to the requested types', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, 'x', ['note', 'goal'], FIRST);
		const { sql } = queryOf($queryRaw);
		expect(sql).toContain('FROM notes s');
		expect(sql).toContain('FROM goals s');
		expect(sql).not.toContain('FROM tasks s');
		expect(sql.match(/UNION ALL/g)).toHaveLength(1);
	});
});
