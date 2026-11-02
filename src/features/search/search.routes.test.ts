import type { PrismaClient } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp, TEST_USER_ID } from '../../test/helpers.js';
import routes from './search.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const hit = (n: number) => ({ id: ID, snippet: 'a «b»', title: 'T', type: 'task', updated_at: new Date(Date.UTC(2026, 10, 2, 10, 0, 60 - n)) });

const setup = (claims?: { sub: string } | null, rows: unknown[] = [hit(1)]) => {
	/** First call is the page of hits, second the per-type match counts. */
	const $queryRaw = vi
		.fn()
		.mockResolvedValueOnce(rows)
		.mockResolvedValueOnce([{ n: rows.length }]);
	return { $queryRaw, app: createTestApp(routes, { claims, path: '/search', prisma: { $queryRaw } as unknown as PrismaClient }) };
};

describe('GET /search', () => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request('/search?q=x');
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});

	it('returns the hits with meta, scoped to the user from the claims', async () => {
		const { $queryRaw, app } = setup();
		const res = await app.request('/search?q=bug&types=task,note');
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: [{ id: ID, snippet: 'a «b»', type: 'task' }], meta: { page: 1, pageCount: 1, pageSize: 50, total: 1 } });
		expect($queryRaw.mock.calls[0]?.[0].values).toContain(TEST_USER_ID);
	});

	it('paginates: the page window goes to the query and the meta reports the total', async () => {
		const { $queryRaw, app } = setup(undefined, [hit(1), hit(2)]);
		const body = (await (await app.request('/search?q=x&page=2&pageSize=2')).json()) as { data: unknown[]; meta: unknown };
		expect(body.data).toHaveLength(2);
		expect(body.meta).toEqual({ page: 2, pageCount: 1, pageSize: 2, total: 2 });
		expect($queryRaw.mock.calls[0]?.[0].values).toEqual(expect.arrayContaining([2]));
	});

	it.each(['', 'q=', 'q=%20%20', `q=${'x'.repeat(201)}`, 'q=x&types=nope', 'q=x&types=', 'q=x&pageSize=0', 'q=x&pageSize=101', 'q=x&page=0'])('answers 422 for ?%s', async query => {
		const { $queryRaw, app } = setup();
		expect((await app.request(`/search?${query}`)).status).toBe(422);
		expect($queryRaw).not.toHaveBeenCalled();
	});
});
