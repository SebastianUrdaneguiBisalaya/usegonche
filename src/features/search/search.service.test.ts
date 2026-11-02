import type { PrismaClient } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { search } from './search.service.js';

const NOW = new Date('2026-11-02T10:00:00Z');
const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';

const setup = (rows: unknown[] = []) => {
	const $queryRaw = vi.fn().mockResolvedValue(rows);
	return { $queryRaw, prisma: { $queryRaw } as unknown as PrismaClient };
};
const queryOf = ($queryRaw: ReturnType<typeof vi.fn>) => $queryRaw.mock.calls[0]?.[0] as { sql: string; values: unknown[] };

describe('search', () => {
	it('maps rows to results with camelCase dates', async () => {
		const { prisma } = setup([{ id: ID, snippet: 'fix «bug»', title: 'Fix', type: 'task', updated_at: NOW }]);
		expect(await search(prisma, TEST_USER_ID, 'bug', undefined, 10)).toEqual([{ id: ID, snippet: 'fix «bug»', title: 'Fix', type: 'task', updatedAt: NOW }]);
	});

	it('searches every type by default, scoped by owner, with the query and limit + 1 as parameters', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, 'my "exact phrase"', undefined, 20);
		const { sql, values } = queryOf($queryRaw);
		for (const table of ['tasks', 'notes', 'projects', 'goals', 'inbox_items']) expect(sql).toContain(`FROM ${table} s`);
		expect(sql.match(/s\.owner_id = /g)).toHaveLength(5);
		expect(sql).toContain('websearch_to_tsquery');
		expect(values).toContain(TEST_USER_ID);
		expect(values).toContain('my "exact phrase"');
		expect(values).toContain(21);
		expect(values).not.toContain(OTHER_USER_ID);
	});

	it('never inlines user input into the SQL text', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, "'; DROP TABLE tasks; --", ['task'], 5);
		expect(queryOf($queryRaw).sql).not.toContain('DROP');
	});

	it('restricts to the requested types', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, 'x', ['note', 'goal'], 5);
		const { sql } = queryOf($queryRaw);
		expect(sql).toContain('FROM notes s');
		expect(sql).toContain('FROM goals s');
		expect(sql).not.toContain('FROM tasks s');
		expect(sql.match(/UNION ALL/g)).toHaveLength(1);
	});

	it('applies the keyset cursor to every branch', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, 'x', ['task', 'note'], 5, { at: NOW, id: ID });
		const { sql, values } = queryOf($queryRaw);
		expect(sql.match(/s\.updated_at < /g)).toHaveLength(2);
		expect(values).toContain(NOW);
		expect(values).toContain(ID);
	});

	it('omits the cursor condition on the first page', async () => {
		const { $queryRaw, prisma } = setup();
		await search(prisma, TEST_USER_ID, 'x', ['task'], 5);
		expect(queryOf($queryRaw).sql).not.toContain('s.updated_at <');
	});
});
