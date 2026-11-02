import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './reminders.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TARGET_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const AT = '2026-11-02T12:00:00.000Z';
const row = { id: ID, ownerId: TEST_USER_ID, remindAt: new Date(AT), status: 'pending', taskId: TARGET_ID };
const post = { method: 'POST' };
const del = { method: 'DELETE' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row));
	vi.mocked(prisma.reminder.create).mockResolvedValue(asRow(row));
	vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
	vi.mocked(prisma.reminder.deleteMany).mockResolvedValue({ count: 1 });
	vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TARGET_ID }));
	return { app: createTestApp(routes, { claims, path: '/reminders', prisma }), prisma };
};

describe.each([
	['GET', '/reminders', undefined],
	['POST', '/reminders', jsonRequest('POST', { remindAt: AT, taskId: TARGET_ID })],
	['GET', `/reminders/${ID}`, undefined],
	['PATCH', `/reminders/${ID}`, jsonRequest('PATCH', { remindAt: AT })],
	['POST', `/reminders/${ID}/snooze`, jsonRequest('POST', { remindAt: AT })],
	['POST', `/reminders/${ID}/dismiss`, post],
	['DELETE', `/reminders/${ID}`, del],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /reminders', () => {
	it('lists the reminders of the user with meta and filters', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue(asRow([row]));
		vi.mocked(prisma.reminder.count).mockResolvedValue(1);
		const res = await app.request(`/reminders?status=pending&taskId=${TARGET_ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: [{ id: ID }], meta: { page: 1, pageCount: 1, pageSize: 50, total: 1 } });
		expect(prisma.reminder.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { calendarEventId: undefined, noteId: undefined, ownerId: TEST_USER_ID, status: 'pending', taskId: TARGET_ID } })
		);
	});

	it.each(['status=nope', 'taskId=x', 'page=0', 'pageSize=0'])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/reminders?${query}`)).status).toBe(422);
	});
});

describe('POST /reminders', () => {
	it('creates a reminder for the user from the claims (201)', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/reminders', jsonRequest('POST', { remindAt: AT, taskId: TARGET_ID }));
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ data: { id: ID } });
		expect(vi.mocked(prisma.reminder.create).mock.calls[0]?.[0]?.data).toMatchObject({ ownerId: TEST_USER_ID, taskId: TARGET_ID });
	});

	it("answers 422 with details when the target is not the user's", async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		const res = await app.request('/reminders', jsonRequest('POST', { remindAt: AT, taskId: TARGET_ID }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ code: 'not_found', field: 'taskId' }] } });
	});

	it.each([
		['no target', { remindAt: AT }],
		['two targets', { noteId: TARGET_ID, remindAt: AT, taskId: TARGET_ID }],
		['no remindAt', { taskId: TARGET_ID }],
		['a remindAt without timezone', { remindAt: '2026-11-02T12:00:00', taskId: TARGET_ID }],
		['unknown keys (owner from the body)', { ownerId: TARGET_ID, remindAt: AT, taskId: TARGET_ID }],
		['a non-uuid target', { remindAt: AT, taskId: 'x' }],
	])('answers 422 for %s', async (_name, body) => {
		expect((await setup().app.request('/reminders', jsonRequest('POST', body))).status).toBe(422);
	});
});

describe('GET /reminders/:id', () => {
	it('returns the reminder', async () => {
		const res = await setup().app.request(`/reminders/${ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: { id: ID } });
	});

	it('answers 404 when it does not exist and 422 for a bad id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(null);
		expect((await app.request(`/reminders/${ID}`)).status).toBe(404);
		expect((await app.request('/reminders/nope')).status).toBe(422);
	});
});

describe('PATCH /reminders/:id', () => {
	it('reschedules a pending reminder', async () => {
		expect((await setup().app.request(`/reminders/${ID}`, jsonRequest('PATCH', { remindAt: AT }))).status).toBe(200);
	});

	it('answers 409 for a sent reminder and 422 for an empty or unknown body', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow({ ...row, status: 'sent' }));
		expect((await app.request(`/reminders/${ID}`, jsonRequest('PATCH', { remindAt: AT }))).status).toBe(409);
		expect((await app.request(`/reminders/${ID}`, jsonRequest('PATCH', {}))).status).toBe(422);
		expect((await app.request(`/reminders/${ID}`, jsonRequest('PATCH', { status: 'sent' }))).status).toBe(422);
	});
});

describe('POST /reminders/:id/snooze', () => {
	it('snoozes the reminder', async () => {
		const { app, prisma } = setup();
		const res = await app.request(`/reminders/${ID}/snooze`, jsonRequest('POST', { remindAt: AT }));
		expect(res.status).toBe(200);
		expect(vi.mocked(prisma.reminder.updateMany).mock.calls[0]?.[0]?.where).toMatchObject({ ownerId: TEST_USER_ID });
	});

	it('answers 409 for a dismissed reminder and 422 without remindAt', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow({ ...row, status: 'dismissed' }));
		expect((await app.request(`/reminders/${ID}/snooze`, jsonRequest('POST', { remindAt: AT }))).status).toBe(409);
		expect((await app.request(`/reminders/${ID}/snooze`, jsonRequest('POST', {}))).status).toBe(422);
	});
});

describe('POST /reminders/:id/dismiss', () => {
	it('dismisses the reminder', async () => {
		const res = await setup().app.request(`/reminders/${ID}/dismiss`, post);
		expect(res.status).toBe(200);
	});

	it('answers 404 when it does not exist', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(null);
		expect((await app.request(`/reminders/${ID}/dismiss`, post)).status).toBe(404);
	});
});

describe('DELETE /reminders/:id', () => {
	it('deletes the reminder scoped by the user', async () => {
		const { app, prisma } = setup();
		const res = await app.request(`/reminders/${ID}`, del);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { id: ID } });
		expect(prisma.reminder.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('answers 404 when nothing matched', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.reminder.deleteMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/reminders/${ID}`, del)).status).toBe(404);
	});
});
