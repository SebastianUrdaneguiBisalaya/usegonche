import type { InboxItem } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './inbox.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const item = { content: 'call mom', id: ID, ownerId: TEST_USER_ID, source: 'quick', status: 'pending' } as InboxItem;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	return { app: createTestApp(routes, { claims, path: '/inbox', prisma }), prisma };
};

describe.each([
	['GET', '/inbox', undefined],
	['POST', '/inbox', jsonRequest('POST', { content: 'x' })],
	['POST', '/inbox/brain-dump', jsonRequest('POST', { text: 'x' })],
	['PATCH', `/inbox/${ID}`, jsonRequest('PATCH', { status: 'archived' })],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /inbox', () => {
	it('lists pending items of the user by default with meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([item]);

		const res = await app.request('/inbox');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [item], meta: { limit: 50, status: 'pending' } });
		expect(prisma.inboxItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50, where: { ownerId: TEST_USER_ID, status: 'pending' } }));
	});

	it('filters by status and limit', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([]);
		await app.request('/inbox?status=archived&limit=5');
		expect(prisma.inboxItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5, where: { ownerId: TEST_USER_ID, status: 'archived' } }));
	});

	it.each(['status=bogus', 'limit=0', 'limit=1000'])('rejects ?%s with 422', async query => {
		const { app, prisma } = setup();
		const res = await app.request(`/inbox?${query}`);
		expect(res.status).toBe(422);
		expect(prisma.inboxItem.findMany).not.toHaveBeenCalled();
	});
});

describe('POST /inbox', () => {
	it('captures an item with 201', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.create).mockResolvedValue(item);

		const res = await app.request('/inbox', jsonRequest('POST', { content: '  call mom ' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: item });
		expect(prisma.inboxItem.create).toHaveBeenCalledWith({ data: { content: 'call mom', ownerId: TEST_USER_ID, source: 'quick' } });
	});

	it.each([
		['empty content', { content: '  ' }],
		['too long content', { content: 'x'.repeat(2001) }],
		['unknown keys (status, owner)', { content: 'x', ownerId: 'y', status: 'converted' }],
	])('rejects %s with 422', async (_label, body) => {
		const { app, prisma } = setup();
		const res = await app.request('/inbox', jsonRequest('POST', body));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
		expect(prisma.inboxItem.create).not.toHaveBeenCalled();
	});
});

describe('POST /inbox/brain-dump', () => {
	it('creates one item per non-empty line with 201', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.createManyAndReturn).mockResolvedValue([item, item]);

		const res = await app.request('/inbox/brain-dump', jsonRequest('POST', { text: 'a\n\n  b  \n' }));
		expect(res.status).toBe(201);
		expect(vi.mocked(prisma.inboxItem.createManyAndReturn).mock.calls[0]?.[0]?.data).toEqual([
			{ content: 'a', ownerId: TEST_USER_ID, source: 'braindump' },
			{ content: 'b', ownerId: TEST_USER_ID, source: 'braindump' },
		]);
	});

	it('rejects a text without content with 422', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/inbox/brain-dump', jsonRequest('POST', { text: ' \n ' }));
		expect(res.status).toBe(422);
		expect(prisma.inboxItem.createManyAndReturn).not.toHaveBeenCalled();
	});
});

describe('PATCH /inbox/:id', () => {
	it.each(['archived', 'discarded', 'pending'])('sets the status to %s', async status => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue({ ...item, status } as InboxItem);

		const res = await app.request(`/inbox/${ID}`, jsonRequest('PATCH', { status }));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ data: { status } });
	});

	it("answers 404 for an item that is not the user's", async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(null);
		const res = await app.request(`/inbox/${ID}`, jsonRequest('PATCH', { status: 'archived' }));
		expect(res.status).toBe(404);
	});

	it('answers 409 invalid_state for a converted item', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue({ id: ID } as InboxItem);
		const res = await app.request(`/inbox/${ID}`, jsonRequest('PATCH', { status: 'archived' }));
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: { code: 'invalid_state' } });
	});

	it.each([
		['converted status', `/inbox/${ID}`, { status: 'converted' }],
		['an invalid id', '/inbox/nope', { status: 'archived' }],
		['an empty body', `/inbox/${ID}`, {}],
	])('rejects %s with 422', async (_label, path, body) => {
		const { app, prisma } = setup();
		const res = await app.request(path, jsonRequest('PATCH', body));
		expect(res.status).toBe(422);
		expect(prisma.inboxItem.updateMany).not.toHaveBeenCalled();
	});
});
