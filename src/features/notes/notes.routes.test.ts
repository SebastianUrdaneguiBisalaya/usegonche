import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './notes.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const OTHER = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const row = { createdAt: new Date('2026-11-01T10:00:00.000Z'), id: ID, ownerId: TEST_USER_ID, tags: [], tasks: [], title: 'Meeting' };
const body = { ...JSON.parse(JSON.stringify(row)), tags: [], taskIds: [] };
const { tasks: _tasks, ...expected } = body;
void _tasks;
const del = { method: 'DELETE' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	return { app: createTestApp(routes, { claims, path: '/notes', prisma }), prisma };
};

describe.each([
	['GET', '/notes', undefined],
	['POST', '/notes', jsonRequest('POST', { title: 'x' })],
	['GET', `/notes/${ID}`, undefined],
	['PATCH', `/notes/${ID}`, jsonRequest('PATCH', { title: 'x' })],
	['DELETE', `/notes/${ID}`, del],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /notes', () => {
	it('lists notes of the user with meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.findMany).mockResolvedValue(asRow([row]));
		const res = await app.request('/notes');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [expected], meta: { limit: 50, nextCursor: null } });
		expect(prisma.note.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51, where: { ownerId: TEST_USER_ID } }));
	});

	it('applies filters', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.findMany).mockResolvedValue([]);
		await app.request(`/notes?projectId=${OTHER}&taskId=${ID}&tagId=${OTHER}&limit=5`);
		expect(prisma.note.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ take: 6, where: { ownerId: TEST_USER_ID, projectId: OTHER, tags: { some: { tagId: OTHER } }, tasks: { some: { taskId: ID } } } })
		);
	});

	it.each(['projectId=nope', 'taskId=nope', 'tagId=nope', 'cursor=garbage'])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/notes?${query}`)).status).toBe(422);
	});
});

describe('POST /notes', () => {
	it('creates a note for the claims user (201)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request('/notes', jsonRequest('POST', { body: '{"type":"doc"}', title: '  Meeting  ' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: expected });
		expect(prisma.note.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ body: '{"type":"doc"}', ownerId: TEST_USER_ID, title: 'Meeting' }) }));
	});

	it('answers 422 with details when the project is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		const res = await app.request('/notes', jsonRequest('POST', { projectId: OTHER, title: 'a' }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ code: 'not_found', field: 'projectId' }] } });
	});

	it('answers 409 when the origin inbox item is not pending', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(asRow({ id: OTHER }));
		expect((await app.request('/notes', jsonRequest('POST', { originInboxItemId: OTHER, title: 'a' }))).status).toBe(409);
	});

	it.each([
		['empty title', { title: '' }],
		['unknown key', { ownerId: 'x', title: 'a' }],
		['non-JSON body', { body: '<p>x</p>', title: 'a' }],
		['bad task id', { taskIds: ['nope'], title: 'a' }],
		['bad tag id', { tagIds: ['nope'], title: 'a' }],
	])('answers 422 for %s', async (_name, payload) => {
		const { app, prisma } = setup();
		expect((await app.request('/notes', jsonRequest('POST', payload))).status).toBe(422);
		expect(prisma.note.create).not.toHaveBeenCalled();
	});
});

describe('GET /notes/:id', () => {
	it('returns the note', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/notes/${ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: expected });
	});

	it('answers 404 when not found and 422 for a bad id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
		expect((await app.request(`/notes/${ID}`)).status).toBe(404);
		expect((await app.request('/notes/nope')).status).toBe(422);
	});
});

describe('PATCH /notes/:id', () => {
	it('updates the note', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow({ ...row, body: '{}', projectId: OTHER }));
		const res = await app.request(`/notes/${ID}`, jsonRequest('PATCH', { body: null, projectId: null }));
		expect(res.status).toBe(200);
		expect(prisma.note.updateMany).toHaveBeenCalledWith({ data: { body: null, projectId: null }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('answers 200 with the note and writes nothing when nothing changes', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow(row));
		const res = await app.request(`/notes/${ID}`, jsonRequest('PATCH', { title: 'Meeting' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: expected });
		expect(prisma.note.updateMany).not.toHaveBeenCalled();
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
		expect((await app.request(`/notes/${ID}`, jsonRequest('PATCH', { title: 'x' }))).status).toBe(404);
	});

	it.each([
		['empty body', {}],
		['unknown key', { originInboxItemId: OTHER }],
		['non-JSON body', { body: 'plain' }],
	])('answers 422 for %s', async (_name, payload) => {
		expect((await setup().app.request(`/notes/${ID}`, jsonRequest('PATCH', payload))).status).toBe(422);
	});
});

describe('DELETE /notes/:id', () => {
	it('deletes and answers the id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);
		vi.mocked(prisma.note.deleteMany).mockResolvedValue({ count: 1 });
		const res = await app.request(`/notes/${ID}`, del);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { id: ID } });
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);
		vi.mocked(prisma.note.deleteMany).mockResolvedValue({ count: 0 });
		expect((await app.request(`/notes/${ID}`, del)).status).toBe(404);
	});
});
