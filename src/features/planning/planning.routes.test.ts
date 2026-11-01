import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './planning.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TASK = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const DATE = '2026-11-02';
const del = { method: 'DELETE' };
const put = (body: unknown) => jsonRequest('PUT' as 'POST', body);

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue([]);
	vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValue([]);
	return { app: createTestApp(routes, { claims, path: '/planning', prisma }), prisma };
};

describe.each([
	['GET', '/planning/availability', undefined],
	['PUT', '/planning/availability', put({ windows: [] })],
	['GET', `/planning/events?from=${DATE}&to=${DATE}`, undefined],
	['POST', '/planning/events', jsonRequest('POST', { endsAt: '2026-11-02T11:00:00Z', startsAt: '2026-11-02T10:00:00Z', title: 'x' })],
	['PATCH', `/planning/events/${ID}`, jsonRequest('PATCH', { title: 'x' })],
	['DELETE', `/planning/events/${ID}`, del],
	['GET', `/planning/days/${DATE}`, undefined],
	['PUT', `/planning/days/${DATE}/items`, put({ taskIds: [] })],
	['GET', `/planning/blocks?from=${DATE}&to=${DATE}`, undefined],
	['POST', '/planning/blocks', jsonRequest('POST', { plannedEnd: '2026-11-02T11:00:00Z', plannedStart: '2026-11-02T10:00:00Z', title: 'x' })],
	['PATCH', `/planning/blocks/${ID}`, jsonRequest('PATCH', { status: 'missed' })],
	['POST', `/planning/blocks/${ID}/move`, jsonRequest('POST', { plannedEnd: '2026-11-02T11:00:00Z', plannedStart: '2026-11-02T10:00:00Z' })],
	['DELETE', `/planning/blocks/${ID}`, del],
	['GET', `/planning/replan-proposals?date=${DATE}`, undefined],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('availability', () => {
	it('gets and replaces the weekly template', async () => {
		const { app, prisma } = setup();
		const get = await app.request('/planning/availability');
		expect(get.status).toBe(200);
		expect(await get.json()).toEqual({ data: { timezone: 'UTC', weeklyMinutes: 0, windows: [] } });

		const res = await app.request('/planning/availability', put({ windows: [{ endMinute: 1020, startMinute: 540, weekday: 1 }] }));
		expect(res.status).toBe(200);
		expect(prisma.availabilityWindow.createMany).toHaveBeenCalledWith({ data: [{ endMinute: 1020, ownerId: TEST_USER_ID, startMinute: 540, weekday: 1 }] });
	});

	it.each([
		['weekday 8', { windows: [{ endMinute: 600, startMinute: 540, weekday: 8 }] }],
		['end before start', { windows: [{ endMinute: 500, startMinute: 540, weekday: 1 }] }],
		['minute over 1440', { windows: [{ endMinute: 1441, startMinute: 540, weekday: 1 }] }],
		[
			'overlapping windows',
			{
				windows: [
					{ endMinute: 700, startMinute: 540, weekday: 1 },
					{ endMinute: 800, startMinute: 600, weekday: 1 },
				],
			},
		],
		['unknown key', { extra: 1, windows: [] }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = setup();
		expect((await app.request('/planning/availability', put(body))).status).toBe(422);
		expect(prisma.availabilityWindow.deleteMany).not.toHaveBeenCalled();
	});

	it('accepts adjacent windows on the same weekday', async () => {
		const { app } = setup();
		const body = {
			windows: [
				{ endMinute: 720, startMinute: 540, weekday: 1 },
				{ endMinute: 1020, startMinute: 720, weekday: 1 },
			],
		};
		expect((await app.request('/planning/availability', put(body))).status).toBe(200);
	});
});

describe('events', () => {
	const event = { allDay: false, endsAt: new Date('2026-11-02T11:00:00Z'), id: ID, kind: 'event', ownerId: TEST_USER_ID, startsAt: new Date('2026-11-02T10:00:00Z'), title: 'Sync' };

	it('lists events of a date range', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue(asRow([event]));
		const res = await app.request(`/planning/events?from=${DATE}&to=2026-11-03`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [JSON.parse(JSON.stringify(event))] });
	});

	it.each(['', `from=${DATE}`, `from=${DATE}&to=2026-11-01`, `from=${DATE}&to=2027-03-01`, 'from=nope&to=2026-11-03', 'from=2026-02-30&to=2026-03-01'])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/planning/events?${query}`)).status).toBe(422);
	});

	it('creates a timed and an all-day event (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.calendarEvent.create).mockResolvedValue(asRow(event));
		const timed = await app.request('/planning/events', jsonRequest('POST', { endsAt: '2026-11-02T11:00:00Z', startsAt: '2026-11-02T10:00:00Z', title: 'Sync' }));
		expect(timed.status).toBe(201);
		const allDay = await app.request('/planning/events', jsonRequest('POST', { allDay: true, kind: 'out_of_office', startDate: DATE, title: 'Trip' }));
		expect(allDay.status).toBe(201);
		expect(prisma.calendarEvent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ allDay: true, kind: 'out_of_office', ownerId: TEST_USER_ID }) });
	});

	it.each([
		['end before start', { endsAt: '2026-11-02T09:00:00Z', startsAt: '2026-11-02T10:00:00Z', title: 'x' }],
		['missing end', { startsAt: '2026-11-02T10:00:00Z', title: 'x' }],
		['instant without offset', { endsAt: '2026-11-02T11:00:00', startsAt: '2026-11-02T10:00:00', title: 'x' }],
		['all-day end before start', { allDay: true, endDate: '2026-11-01', startDate: DATE, title: 'x' }],
		['all-day with instants', { allDay: true, endsAt: '2026-11-02T11:00:00Z', startsAt: '2026-11-02T10:00:00Z', title: 'x' }],
		['bad kind', { endsAt: '2026-11-02T11:00:00Z', kind: 'party', startsAt: '2026-11-02T10:00:00Z', title: 'x' }],
		['empty title', { endsAt: '2026-11-02T11:00:00Z', startsAt: '2026-11-02T10:00:00Z', title: ' ' }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = setup();
		expect((await app.request('/planning/events', jsonRequest('POST', body))).status).toBe(422);
		expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
	});

	it('updates, answers 404 when missing, 422 for an empty patch, and deletes', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(asRow(event));
		expect((await app.request(`/planning/events/${ID}`, jsonRequest('PATCH', { title: 'New' }))).status).toBe(200);
		expect((await app.request(`/planning/events/${ID}`, jsonRequest('PATCH', {}))).status).toBe(422);

		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(null);
		expect((await app.request(`/planning/events/${ID}`, jsonRequest('PATCH', { title: 'x' }))).status).toBe(404);

		vi.mocked(prisma.calendarEvent.deleteMany).mockResolvedValue({ count: 1 });
		const res = await app.request(`/planning/events/${ID}`, del);
		expect(await res.json()).toEqual({ data: { id: ID } });
		vi.mocked(prisma.calendarEvent.deleteMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/planning/events/${ID}`, del)).status).toBe(404);
	});
});

describe('no-op updates (idempotent)', () => {
	const event = { allDay: false, endsAt: new Date('2026-11-02T11:00:00Z'), id: ID, kind: 'event', ownerId: TEST_USER_ID, startsAt: new Date('2026-11-02T10:00:00Z'), title: 'Sync' };

	it('PATCH /events/:id with the stored values answers 200 and writes nothing', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(asRow(event));
		const res = await app.request(`/planning/events/${ID}`, jsonRequest('PATCH', { title: 'Sync' }));
		expect(res.status).toBe(200);
		expect(prisma.calendarEvent.updateMany).not.toHaveBeenCalled();
	});

	it('PUT /availability with the stored template answers 200 and rewrites nothing', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(asRow([{ endMinute: 1020, id: 'w', ownerId: TEST_USER_ID, startMinute: 540, weekday: 1 }]));
		const res = await app.request('/planning/availability', put({ windows: [{ endMinute: 1020, startMinute: 540, weekday: 1 }] }));
		expect(res.status).toBe(200);
		expect(prisma.availabilityWindow.deleteMany).not.toHaveBeenCalled();
		expect(prisma.availabilityWindow.createMany).not.toHaveBeenCalled();
	});

	it('PUT /days/:date/items with the same ordered tasks answers 200 and rewrites nothing', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: TASK, status: 'todo' }]));
		vi.mocked(prisma.dailyPlan.upsert).mockResolvedValue(asRow({ id: 'plan', items: [{ taskId: TASK }] }));
		vi.mocked(prisma.dailyPlan.findFirst).mockResolvedValue(null);
		const res = await app.request(`/planning/days/${DATE}/items`, put({ taskIds: [TASK] }));
		expect(res.status).toBe(200);
		expect(prisma.dailyPlanItem.deleteMany).not.toHaveBeenCalled();
		expect(prisma.dailyPlanItem.createMany).not.toHaveBeenCalled();
	});
});

describe('days', () => {
	it('returns the day with capacity', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.dailyPlan.findFirst).mockResolvedValue(null);
		const res = await app.request(`/planning/days/${DATE}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: { capacity: { availableMinutes: 0, overcommitted: false }, date: DATE, items: [], timezone: 'UTC' } });
	});

	it.each(['nope', '2026-02-30', '2026-1-1'])('answers 422 for date %s', async date => {
		const { app } = setup();
		expect((await app.request(`/planning/days/${date}`)).status).toBe(422);
		expect((await app.request(`/planning/days/${date}/items`, put({ taskIds: [] }))).status).toBe(422);
	});

	it('sets the day tasks', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: TASK, status: 'todo' }]));
		vi.mocked(prisma.dailyPlan.upsert).mockResolvedValue(asRow({ id: 'plan', items: [] }));
		vi.mocked(prisma.dailyPlan.findFirst).mockResolvedValue(null);
		const res = await app.request(`/planning/days/${DATE}/items`, put({ taskIds: [TASK] }));
		expect(res.status).toBe(200);
		expect(prisma.dailyPlanItem.createMany).toHaveBeenCalledWith({ data: [{ ownerId: TEST_USER_ID, planId: 'plan', position: 0, taskId: TASK }] });
	});

	it.each([
		['duplicates', { taskIds: [TASK, TASK] }],
		['bad id', { taskIds: ['nope'] }],
		['missing list', {}],
		['unknown key', { extra: 1, taskIds: [] }],
	])('answers 422 for %s', async (_name, body) => {
		expect((await setup().app.request(`/planning/days/${DATE}/items`, put(body))).status).toBe(422);
	});

	it('answers 422 when a task is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		const res = await app.request(`/planning/days/${DATE}/items`, put({ taskIds: [TASK] }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { details: [{ code: 'not_found', field: 'taskIds' }] } });
	});
});

describe('blocks', () => {
	const block = { id: ID, ownerId: TEST_USER_ID, plannedEnd: new Date('2026-11-02T11:00:00Z'), plannedStart: new Date('2026-11-02T10:00:00Z'), status: 'planned', taskId: TASK, title: null };
	const range = { plannedEnd: '2026-11-02T11:00:00Z', plannedStart: '2026-11-02T10:00:00Z' };

	it('creates a block and returns warnings (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ status: 'todo' }));
		vi.mocked(prisma.timeBlock.create).mockResolvedValue(asRow(block));
		const res = await app.request('/planning/blocks', jsonRequest('POST', { ...range, taskId: TASK }));
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ data: { id: ID, warnings: [{ code: 'outside_availability' }] } });
	});

	it('answers 422 for a done task', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ status: 'done' }));
		const res = await app.request('/planning/blocks', jsonRequest('POST', { ...range, taskId: TASK }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { details: [{ code: 'task_closed', field: 'taskId' }] } });
	});

	it.each([
		['end not after start', { plannedEnd: '2026-11-02T10:00:00Z', plannedStart: '2026-11-02T10:00:00Z', title: 'x' }],
		['neither task nor title', range],
		['bad task id', { ...range, taskId: 'nope' }],
		['unknown key', { ...range, status: 'done', title: 'x' }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = setup();
		expect((await app.request('/planning/blocks', jsonRequest('POST', body))).status).toBe(422);
		expect(prisma.timeBlock.create).not.toHaveBeenCalled();
	});

	it('lists blocks of a range with an optional status', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.timeBlock.findMany).mockResolvedValue(asRow([block]));
		expect((await app.request(`/planning/blocks?from=${DATE}&to=${DATE}&status=missed`)).status).toBe(200);
		expect((await app.request(`/planning/blocks?from=${DATE}&to=${DATE}&status=nope`)).status).toBe(422);
		expect((await app.request(`/planning/blocks?from=${DATE}`)).status).toBe(422);
	});

	it('closes a block, answers 409 when it is not planned and 404 when missing', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(asRow(block));
		expect((await app.request(`/planning/blocks/${ID}`, jsonRequest('PATCH', { status: 'missed' }))).status).toBe(200);

		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(asRow({ ...block, status: 'done' }));
		expect((await app.request(`/planning/blocks/${ID}`, jsonRequest('PATCH', { status: 'missed' }))).status).toBe(409);

		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(null);
		expect((await app.request(`/planning/blocks/${ID}`, jsonRequest('PATCH', { status: 'missed' }))).status).toBe(404);
	});

	it.each([
		['empty body', {}],
		['bad status', { status: 'planned' }],
		['interrupted without actuals', { status: 'interrupted' }],
		['actual end before start', { actualEnd: '2026-11-02T09:00:00Z', actualStart: '2026-11-02T10:00:00Z' }],
	])('answers 422 on update for %s', async (_name, body) => {
		expect((await setup().app.request(`/planning/blocks/${ID}`, jsonRequest('PATCH', body))).status).toBe(422);
	});

	it('moves a block creating a new one (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(asRow(block));
		vi.mocked(prisma.timeBlock.count).mockResolvedValue(0);
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ status: 'todo' }));
		vi.mocked(prisma.timeBlock.create).mockResolvedValue(asRow({ ...block, id: TASK, rescheduledFromId: ID }));
		const res = await app.request(`/planning/blocks/${ID}/move`, jsonRequest('POST', { plannedEnd: '2026-11-02T15:00:00Z', plannedStart: '2026-11-02T14:00:00Z' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ data: { id: TASK, rescheduledFromId: ID } });
	});

	it('answers 409 when moving a done block and 422 for a bad range', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(asRow({ ...block, status: 'done' }));
		expect((await app.request(`/planning/blocks/${ID}/move`, jsonRequest('POST', range))).status).toBe(409);
		expect((await app.request(`/planning/blocks/${ID}/move`, jsonRequest('POST', { plannedEnd: '2026-11-02T09:00:00Z', plannedStart: '2026-11-02T10:00:00Z' }))).status).toBe(422);
	});

	it('deletes planned blocks only', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(asRow(block));
		expect(await (await app.request(`/planning/blocks/${ID}`, del)).json()).toEqual({ data: { id: ID } });
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(asRow({ ...block, status: 'missed' }));
		expect((await app.request(`/planning/blocks/${ID}`, del)).status).toBe(409);
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(null);
		expect((await app.request(`/planning/blocks/${ID}`, del)).status).toBe(404);
	});
});

describe('GET /planning/replan-proposals', () => {
	it('returns proposals (none here) and validates the query', async () => {
		const { app } = setup();
		const res = await app.request(`/planning/replan-proposals?date=${DATE}&days=3`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [] });
		expect((await app.request('/planning/replan-proposals')).status).toBe(422);
		expect((await app.request(`/planning/replan-proposals?date=${DATE}&days=30`)).status).toBe(422);
	});
});
