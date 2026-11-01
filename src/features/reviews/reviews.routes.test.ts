import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './reviews.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TASK = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const row = {
	createdAt: new Date('2026-11-02T10:00:00Z'),
	decisions: [],
	id: ID,
	kind: 'daily',
	ownerId: TEST_USER_ID,
	periodEnd: new Date('2026-11-02'),
	periodStart: new Date('2026-11-02'),
	status: 'open',
};

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue([]);
	vi.mocked(prisma.task.findMany).mockResolvedValue([]);
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValue([]);
	vi.mocked(prisma.taskBlocker.findMany).mockResolvedValue([]);
	vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([]);
	return { app: createTestApp(routes, { claims, path: '/reviews', prisma }), prisma };
};

describe.each([
	['GET', '/reviews', undefined],
	['POST', '/reviews', jsonRequest('POST', { date: '2026-11-02', kind: 'daily' })],
	['GET', `/reviews/${ID}`, undefined],
	['PATCH', `/reviews/${ID}`, jsonRequest('PATCH', { reflection: 'x' })],
	['POST', `/reviews/${ID}/decisions`, jsonRequest('POST', { decisions: [{ action: 'keep', taskId: TASK }] })],
	['POST', `/reviews/${ID}/close`, jsonRequest('POST', {})],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /reviews', () => {
	it('lists reviews with meta and filters', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findMany).mockResolvedValue(asRow([row]));
		const res = await app.request('/reviews?kind=daily&status=open');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [JSON.parse(JSON.stringify(row))], meta: { limit: 50, nextCursor: null } });
		expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51, where: { kind: 'daily', ownerId: TEST_USER_ID, status: 'open' } }));
	});

	it.each(['kind=monthly', 'status=nope', 'cursor=garbage', 'limit=0'])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/reviews?${query}`)).status).toBe(422);
	});
});

describe('POST /reviews', () => {
	it('creates the review (201) with its prefill', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findFirst).mockResolvedValueOnce(null).mockResolvedValue(asRow(row));
		vi.mocked(prisma.review.create).mockResolvedValue(asRow({ id: ID }));
		const res = await app.request('/reviews', jsonRequest('POST', { date: '2026-11-02', kind: 'daily' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ data: { id: ID, prefill: { counters: { plannedTasks: 0 } } } });
		expect(prisma.review.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: TEST_USER_ID }) }));
	});

	it('answers 200 with the existing review', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request('/reviews', jsonRequest('POST', { date: '2026-11-02', kind: 'daily' }));
		expect(res.status).toBe(200);
		expect(prisma.review.create).not.toHaveBeenCalled();
	});

	it.each([
		['bad kind', { date: '2026-11-02', kind: 'monthly' }],
		['bad date', { date: '2026-02-30', kind: 'daily' }],
		['missing date', { kind: 'daily' }],
		['unknown key', { date: '2026-11-02', kind: 'daily', status: 'closed' }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = setup();
		expect((await app.request('/reviews', jsonRequest('POST', body))).status).toBe(422);
		expect(prisma.review.create).not.toHaveBeenCalled();
	});
});

describe('GET /reviews/:id', () => {
	it('returns the review with prefill', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/reviews/${ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: { id: ID, prefill: { missedBlocks: 0, pending: [] } } });
	});

	it('answers 404 when not found and 422 for a bad id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
		expect((await app.request(`/reviews/${ID}`)).status).toBe(404);
		expect((await app.request('/reviews/nope')).status).toBe(422);
	});
});

describe('PATCH /reviews/:id', () => {
	it('updates the reflection', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/reviews/${ID}`, jsonRequest('PATCH', { nextFocus: null, reflection: 'Good' }));
		expect(res.status).toBe(200);
		expect(prisma.review.updateMany).toHaveBeenCalledWith({ data: { reflection: 'Good' }, where: { id: ID, ownerId: TEST_USER_ID, status: 'open' } });
	});

	it('answers 200 and writes nothing when nothing changes', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow({ ...row, reflection: 'Good' }));
		const res = await app.request(`/reviews/${ID}`, jsonRequest('PATCH', { reflection: 'Good' }));
		expect(res.status).toBe(200);
		expect(prisma.review.updateMany).not.toHaveBeenCalled();
	});

	it('answers 409 when closed and 404 when missing', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow({ ...row, status: 'closed' }));
		expect((await app.request(`/reviews/${ID}`, jsonRequest('PATCH', { reflection: 'x' }))).status).toBe(409);
		vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
		expect((await app.request(`/reviews/${ID}`, jsonRequest('PATCH', { reflection: 'x' }))).status).toBe(404);
	});

	it.each([
		['empty body', {}],
		['text too long', { reflection: 'x'.repeat(5001) }],
		['unknown key', { status: 'closed' }],
	])('answers 422 for %s', async (_name, body) => {
		expect((await setup().app.request(`/reviews/${ID}`, jsonRequest('PATCH', body))).status).toBe(422);
	});
});

describe('POST /reviews/:id/decisions', () => {
	const arrange = () => {
		const ctx = setup();
		vi.mocked(ctx.prisma.review.findFirst).mockResolvedValue(asRow({ status: 'open' }));
		vi.mocked(ctx.prisma.reviewDecision.count).mockResolvedValue(0);
		vi.mocked(ctx.prisma.reviewDecision.findMany).mockResolvedValue([]);
		vi.mocked(ctx.prisma.task.findFirst).mockResolvedValue(asRow({ dueDate: null, priority: 'low', projectId: null, startDate: null, status: 'todo' }));
		return ctx;
	};

	it('applies the decisions (201)', async () => {
		const { app, prisma } = arrange();
		const res = await app.request(`/reviews/${ID}/decisions`, jsonRequest('POST', { decisions: [{ action: 'drop', taskId: TASK }] }));
		expect(res.status).toBe(201);
		expect(prisma.task.updateMany).toHaveBeenCalledWith({ data: { completedAt: null, status: 'cancelled' }, where: { id: TASK, ownerId: TEST_USER_ID } });
	});

	it('answers 409 when the review is closed or the task already has a decision', async () => {
		const closed = arrange();
		vi.mocked(closed.prisma.review.findFirst).mockResolvedValue(asRow({ status: 'closed' }));
		expect((await closed.app.request(`/reviews/${ID}/decisions`, jsonRequest('POST', { decisions: [{ action: 'keep', taskId: TASK }] }))).status).toBe(409);

		const dup = arrange();
		vi.mocked(dup.prisma.reviewDecision.count).mockResolvedValue(1);
		expect((await dup.app.request(`/reviews/${ID}/decisions`, jsonRequest('POST', { decisions: [{ action: 'keep', taskId: TASK }] }))).status).toBe(409);
	});

	it('answers 404 for a review that is not the user’s and 422 for a task that is not', async () => {
		const missing = arrange();
		vi.mocked(missing.prisma.review.findFirst).mockResolvedValue(null);
		expect((await missing.app.request(`/reviews/${ID}/decisions`, jsonRequest('POST', { decisions: [{ action: 'keep', taskId: TASK }] }))).status).toBe(404);

		const other = arrange();
		vi.mocked(other.prisma.task.findFirst).mockResolvedValue(null);
		expect((await other.app.request(`/reviews/${ID}/decisions`, jsonRequest('POST', { decisions: [{ action: 'keep', taskId: TASK }] }))).status).toBe(422);
	});

	it.each([
		['empty list', { decisions: [] }],
		['bad action', { decisions: [{ action: 'delete', taskId: TASK }] }],
		['carry_over without date', { decisions: [{ action: 'carry_over', taskId: TASK }] }],
		['reschedule with a bad date', { decisions: [{ action: 'reschedule', date: '2026-13-01', taskId: TASK }] }],
		['drop with a date', { decisions: [{ action: 'drop', date: '2026-11-03', taskId: TASK }] }],
		[
			'duplicate task',
			{
				decisions: [
					{ action: 'keep', taskId: TASK },
					{ action: 'drop', taskId: TASK },
				],
			},
		],
		['bad task id', { decisions: [{ action: 'keep', taskId: 'nope' }] }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = arrange();
		expect((await app.request(`/reviews/${ID}/decisions`, jsonRequest('POST', body))).status).toBe(422);
		expect(prisma.reviewDecision.createMany).not.toHaveBeenCalled();
	});
});

describe('POST /reviews/:id/close', () => {
	it('closes the review snapshotting the counters', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/reviews/${ID}/close`, jsonRequest('POST', { reflection: 'Done' }));
		expect(res.status).toBe(200);
		expect(prisma.review.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ plannedTasks: 0, reflection: 'Done', status: 'closed' }) }));
	});

	it('answers 409 when already closed, 404 when missing, 422 for bad input', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow({ ...row, status: 'closed' }));
		expect((await app.request(`/reviews/${ID}/close`, jsonRequest('POST', {}))).status).toBe(409);
		vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
		expect((await app.request(`/reviews/${ID}/close`, jsonRequest('POST', {}))).status).toBe(404);
		expect((await app.request(`/reviews/${ID}/close`, jsonRequest('POST', { status: 'open' }))).status).toBe(422);
	});
});
