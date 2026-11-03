import type { Tag } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './tags.routes.js';

const TAG_ID = '0b9c7d1a-5e2f-4c3b-9a8d-6f4e3d2c1b0a';
const tag = { id: TAG_ID, name: 'work', ownerId: TEST_USER_ID } as Tag;
const usage = { notes: 1, projects: 2, tasks: 3 };
const row = { ...tag, _count: usage };
const body = { ...tag, usage };
const unique = () => Object.assign(new Error('unique'), { code: 'P2002' });

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	return { app: createTestApp(routes, { claims, path: '/tags', prisma }), prisma };
};

describe.each([
	['GET', '/tags', undefined],
	['POST', '/tags', jsonRequest('POST', { name: 'work' })],
	['PATCH', `/tags/${TAG_ID}`, jsonRequest('PATCH', { name: 'work' })],
	['DELETE', `/tags/${TAG_ID}`, { method: 'DELETE' }],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const { app } = setup(null);
		const res = await app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /tags', () => {
	it('lists the tags of the authenticated user with usage and page meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([row]);
		vi.mocked(prisma.tag.count).mockResolvedValue(1);

		const res = await app.request('/tags');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [body], meta: { page: 1, pageCount: 1, pageSize: 50, total: 1 } });
		expect(prisma.tag.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: 0, take: 50, where: { ownerId: TEST_USER_ID } }));
	});

	it('applies search, sort, order and page size', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
		vi.mocked(prisma.tag.count).mockResolvedValue(0);
		await app.request('/tags?q=%20wo%20&sort=projects&order=desc&page=2&pageSize=5');
		expect(prisma.tag.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ orderBy: [{ projects: { _count: 'desc' } }, { id: 'desc' }], skip: 5, take: 5, where: { name: { contains: 'wo', mode: 'insensitive' }, ownerId: TEST_USER_ID } })
		);
	});

	it.each(['sort=nope', 'order=up', 'page=0', `q=${'x'.repeat(51)}`])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/tags?${query}`)).status).toBe(422);
	});
});

describe('POST /tags', () => {
	it('creates a tag with 201 and trims the name', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.create).mockResolvedValue({ ...tag, _count: { notes: 0, projects: 0, tasks: 0 } } as Tag);

		const res = await app.request('/tags', jsonRequest('POST', { name: '  work  ' }));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: { ...tag, usage: { notes: 0, projects: 0, tasks: 0 } } });
		expect(prisma.tag.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'work', ownerId: TEST_USER_ID } }));
	});

	it('answers 409 already_exists for a duplicate name', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.create).mockRejectedValue(unique());

		const res = await app.request('/tags', jsonRequest('POST', { name: 'work' }));
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: { code: 'already_exists' } });
	});

	it.each([
		['an empty name', { name: '   ' }],
		['a too long name', { name: 'x'.repeat(51) }],
		['a missing name', {}],
		['an owner in the body', { name: 'work', ownerId: 'x' }],
	])('rejects %s with 422 and details', async (_label, body) => {
		const { app, prisma } = setup();
		const res = await app.request('/tags', jsonRequest('POST', body));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
		expect(prisma.tag.create).not.toHaveBeenCalled();
	});
});

describe('PATCH /tags/:id', () => {
	it('renames the tag', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.tag.findFirst)
			.mockResolvedValueOnce(row)
			.mockResolvedValue({ ...row, name: 'home' });

		const res = await app.request(`/tags/${TAG_ID}`, jsonRequest('PATCH', { name: 'home' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { ...body, name: 'home' } });
	});

	it('answers 200 with the tag and writes nothing when the name is the same', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue(row);
		const res = await app.request(`/tags/${TAG_ID}`, jsonRequest('PATCH', { name: tag.name }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: body });
		expect(prisma.tag.updateMany).not.toHaveBeenCalled();
	});

	it("answers 404 for a tag that is not the user's", async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue(null);

		const res = await app.request(`/tags/${TAG_ID}`, jsonRequest('PATCH', { name: 'home' }));
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
	});

	it('answers 409 when the new name is taken', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue(row);
		vi.mocked(prisma.tag.updateMany).mockRejectedValue(unique());
		const res = await app.request(`/tags/${TAG_ID}`, jsonRequest('PATCH', { name: 'home' }));
		expect(res.status).toBe(409);
	});

	it('rejects a non-uuid id and an invalid body with 422', async () => {
		const { app, prisma } = setup();
		expect((await app.request('/tags/not-a-uuid', jsonRequest('PATCH', { name: 'home' }))).status).toBe(422);
		expect((await app.request(`/tags/${TAG_ID}`, jsonRequest('PATCH', { name: '' }))).status).toBe(422);
		expect(prisma.tag.updateMany).not.toHaveBeenCalled();
	});
});

describe('DELETE /tags/:id', () => {
	it('deletes the tag', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.deleteMany).mockResolvedValue({ count: 1 });

		const res = await app.request(`/tags/${TAG_ID}`, { method: 'DELETE' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { id: TAG_ID } });
		expect(prisma.tag.deleteMany).toHaveBeenCalledWith({ where: { id: TAG_ID, ownerId: TEST_USER_ID } });
	});

	it('answers 404 when the tag does not exist or belongs to someone else', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.deleteMany).mockResolvedValue({ count: 0 });
		const res = await app.request(`/tags/${TAG_ID}`, { method: 'DELETE' });
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
	});

	it('rejects a non-uuid id with 422', async () => {
		const { app } = setup();
		expect((await app.request('/tags/123', { method: 'DELETE' })).status).toBe(422);
	});
});
