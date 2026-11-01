import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './recurrences.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const row = {
	createdAt: new Date('2026-11-01T10:00:00.000Z'),
	generatedUntil: null,
	id: ID,
	ownerId: TEST_USER_ID,
	rule: 'FREQ=WEEKLY;BYDAY=MO',
	startDate: new Date('2026-11-02T00:00:00.000Z'),
	tags: [],
	title: 'Weekly review',
};
const body = { rule: 'FREQ=WEEKLY;BYDAY=MO', startDate: '2026-11-02', title: 'Weekly review' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const del = { method: 'DELETE' };
const post = { method: 'POST' };

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
	vi.mocked(prisma.task.findMany).mockResolvedValue([]);
	vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: 'task-1' }));
	return { app: createTestApp(routes, { claims, path: '/recurrences', prisma }), prisma };
};

describe.each([
	['GET', '/recurrences', undefined],
	['POST', '/recurrences', jsonRequest('POST', body)],
	['GET', `/recurrences/${ID}`, undefined],
	['PATCH', `/recurrences/${ID}`, jsonRequest('PATCH', { title: 'x' })],
	['DELETE', `/recurrences/${ID}`, del],
	['POST', `/recurrences/${ID}/materialize`, post],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /recurrences', () => {
	it('lists the rules of the user with meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.recurrenceRule.findMany).mockResolvedValue(asRow([row]));
		const res = await app.request('/recurrences');
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: [{ id: ID }], meta: { limit: 50, nextCursor: null } });
		expect(prisma.recurrenceRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: TEST_USER_ID } }));
	});

	it('answers 422 for an invalid cursor', async () => {
		expect((await setup().app.request('/recurrences?cursor=nope')).status).toBe(422);
	});
});

describe('POST /recurrences', () => {
	it('creates the rule for the user from the claims (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.recurrenceRule.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.recurrenceRule.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request('/recurrences', jsonRequest('POST', body));
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ data: { id: ID, title: 'Weekly review' } });
		expect(vi.mocked(prisma.recurrenceRule.create).mock.calls[0]?.[0]?.data).toMatchObject({ ownerId: TEST_USER_ID });
	});

	it.each(['FREQ=HOURLY', 'nonsense', 'FREQ=DAILY;TZID=UTC'])('answers 422 invalid_rule for %j', async rule => {
		const res = await setup().app.request('/recurrences', jsonRequest('POST', { ...body, rule }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ field: 'rule' }] } });
	});

	it('answers 422 for unknown keys (the owner can not come from the body)', async () => {
		expect((await setup().app.request('/recurrences', jsonRequest('POST', { ...body, ownerId: ID }))).status).toBe(422);
	});

	it.each([{ startMinute: 540 }, { durationMinutes: 30 }, { durationMinutes: 30, startMinute: 1440 }])('answers 422 for an invalid time of day %j', async time => {
		expect((await setup().app.request('/recurrences', jsonRequest('POST', { ...body, ...time }))).status).toBe(422);
	});

	it('accepts a time of day with a duration', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.recurrenceRule.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.recurrenceRule.findFirst).mockResolvedValue(asRow(row));
		expect((await app.request('/recurrences', jsonRequest('POST', { ...body, durationMinutes: 30, startMinute: 540 }))).status).toBe(201);
	});

	it('answers 422 for a missing title', async () => {
		expect((await setup().app.request('/recurrences', jsonRequest('POST', { rule: body.rule, startDate: body.startDate }))).status).toBe(422);
	});
});

describe('GET/PATCH/DELETE/materialize /recurrences/:id', () => {
	it("answers 404 when the rule is not the user's", async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.recurrenceRule.findFirst).mockResolvedValue(null);
		expect((await app.request(`/recurrences/${ID}`)).status).toBe(404);
		expect((await app.request(`/recurrences/${ID}`, jsonRequest('PATCH', { title: 'x' }))).status).toBe(404);
		expect((await app.request(`/recurrences/${ID}`, del)).status).toBe(404);
		expect((await app.request(`/recurrences/${ID}/materialize`, post)).status).toBe(404);
	});

	it('answers 422 for an invalid id and for an empty update', async () => {
		const { app } = setup();
		expect((await app.request('/recurrences/nope')).status).toBe(422);
		expect((await app.request(`/recurrences/${ID}`, jsonRequest('PATCH', {}))).status).toBe(422);
	});

	it('gets, updates, deletes and materializes', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.recurrenceRule.findFirst).mockResolvedValue(asRow(row));
		expect((await app.request(`/recurrences/${ID}`)).status).toBe(200);
		expect((await app.request(`/recurrences/${ID}`, jsonRequest('PATCH', { title: 'New' }))).status).toBe(200);
		const deleted = await app.request(`/recurrences/${ID}`, del);
		expect(deleted.status).toBe(200);
		expect(await deleted.json()).toEqual({ data: { id: ID } });
		expect((await app.request(`/recurrences/${ID}/materialize`, post)).status).toBe(200);
	});
});
