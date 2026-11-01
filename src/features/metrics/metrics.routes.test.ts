import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, TEST_USER_ID } from '../../test/helpers.js';
import routes from './metrics.routes.js';

const paths = ['summary', 'throughput', 'focus-time', 'planning', 'distribution', 'blockers', 'rhythm'] as const;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
	for (const model of [prisma.task, prisma.timeBlock, prisma.dailyPlanItem, prisma.taskBlocker, prisma.project]) vi.mocked(model.findMany).mockResolvedValue([]);
	vi.mocked(prisma.task.groupBy).mockResolvedValue([] as never);
	vi.mocked(prisma.task.count).mockResolvedValue(0);
	vi.mocked(prisma.taskEvent.count).mockResolvedValue(0);
	return { app: createTestApp(routes, { claims, path: '/metrics', prisma }), prisma };
};

describe.each(paths)('GET /metrics/%s', path => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(`/metrics/${path}`);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});

	it('answers 200 with the data envelope and the range used', async () => {
		const res = await setup().app.request(`/metrics/${path}?from=2026-11-01&to=2026-11-10`);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: { range: { from: '2026-11-01', to: '2026-11-10' } } });
	});

	it('works without any query (last 30 days)', async () => {
		expect((await setup().app.request(`/metrics/${path}`)).status).toBe(200);
	});

	it.each([
		['an invalid date', 'from=2026-13-40'],
		['a malformed date', 'to=yesterday'],
		['a reversed range', 'from=2026-11-10&to=2026-11-01'],
		['more than 366 days', 'from=2024-01-01&to=2026-11-10'],
		['an invalid project id', 'projectId=nope'],
		['an invalid priority', 'priority=critical'],
	])('answers 422 for %s', async (_name, query) => {
		const res = await setup().app.request(`/metrics/${path}?${query}`);
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
	});
});

describe('filters and owner', () => {
	it('passes the filters to the queries and takes the owner from the claims', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/metrics/throughput?from=2026-11-01&to=2026-11-10&projectId=5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e&priority=high');
		expect(res.status).toBe(200);
		expect(vi.mocked(prisma.task.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ ownerId: TEST_USER_ID, priority: 'high', projectId: '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e' });
	});

	it('throughput accepts a week granularity and rejects others', async () => {
		const { app } = setup();
		expect(await (await app.request('/metrics/throughput?granularity=week&from=2026-11-01&to=2026-11-10')).json()).toMatchObject({ data: { granularity: 'week' } });
		expect((await app.request('/metrics/throughput?granularity=month')).status).toBe(422);
	});

	it('ignores an owner sent in the query', async () => {
		const { app, prisma } = setup();
		await app.request('/metrics/summary?ownerId=8a1d5e7c-2b39-4f40-9c6e-7d8b0a1c2e3f');
		for (const call of vi.mocked(prisma.task.count).mock.calls) expect((call[0] as { where: { ownerId: string } }).where.ownerId).toBe(TEST_USER_ID);
	});
});
