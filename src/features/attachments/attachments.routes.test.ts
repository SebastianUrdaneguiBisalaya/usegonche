import type { Attachment } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createMockStorage, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './attachments.routes.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TASK_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const FOLDER_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const PATH = `${TEST_USER_ID}/${FOLDER_ID}/file`;
const attachment = { createdAt: new Date('2026-11-01T10:00:00.000Z'), id: ID, ownerId: TEST_USER_ID, storagePath: PATH, taskId: TASK_ID } as Attachment;
const json = JSON.parse(JSON.stringify(attachment));
const register = { mimeType: 'application/pdf', name: 'spec.pdf', path: PATH, sizeBytes: 1024, taskId: TASK_ID };
const del = { method: 'DELETE' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	const storage = createMockStorage();
	return { app: createTestApp(routes, { claims, path: '/attachments', prisma, storage }), prisma, storage };
};

describe.each([
	['GET', `/attachments?taskId=${TASK_ID}`, undefined],
	['POST', '/attachments/upload-url', jsonRequest('POST', { mimeType: 'image/png', sizeBytes: 1, taskId: TASK_ID })],
	['POST', '/attachments', jsonRequest('POST', register)],
	['GET', `/attachments/${ID}/url`, undefined],
	['DELETE', `/attachments/${ID}`, del],
] as const)('%s %s', (_method, path, init) => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request(path, init);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('POST /attachments/upload-url', () => {
	it('returns the signed upload url', async () => {
		const { app, prisma, storage } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TASK_ID }));
		vi.mocked(storage.uploadUrl).mockResolvedValue({ path: PATH, token: 'tok', uploadUrl: 'https://upload', visibility: 'private' });
		const res = await app.request('/attachments/upload-url', jsonRequest('POST', { mimeType: 'image/png', sizeBytes: 100, taskId: TASK_ID }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { path: PATH, token: 'tok', uploadUrl: 'https://upload', visibility: 'private' } });
	});

	it('answers 422 when the target is not the user’s', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect((await app.request('/attachments/upload-url', jsonRequest('POST', { mimeType: 'image/png', sizeBytes: 100, taskId: TASK_ID }))).status).toBe(422);
	});

	it.each([
		['no target', { mimeType: 'image/png', sizeBytes: 1 }],
		['two targets', { mimeType: 'image/png', noteId: ID, sizeBytes: 1, taskId: TASK_ID }],
		['file too large', { mimeType: 'image/png', sizeBytes: 51 * 1024 * 1024, taskId: TASK_ID }],
		['empty file', { mimeType: 'image/png', sizeBytes: 0, taskId: TASK_ID }],
		['bad mime type', { mimeType: 'png', sizeBytes: 1, taskId: TASK_ID }],
		['unknown key', { mimeType: 'image/png', ownerId: 'x', sizeBytes: 1, taskId: TASK_ID }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, storage } = setup();
		expect((await app.request('/attachments/upload-url', jsonRequest('POST', body))).status).toBe(422);
		expect(storage.uploadUrl).not.toHaveBeenCalled();
	});
});

describe('POST /attachments', () => {
	it('records the metadata for the claims user (201)', async () => {
		const { app, prisma, storage } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TASK_ID }));
		vi.mocked(storage.list).mockResolvedValue(asRow([{ name: 'file' }]));
		vi.mocked(prisma.attachment.create).mockResolvedValue(attachment);
		const res = await app.request('/attachments', jsonRequest('POST', register));
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: json });
		expect(prisma.attachment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ownerId: TEST_USER_ID, storagePath: PATH }) });
	});

	it('answers 422 for a path outside the user’s folder', async () => {
		const { app } = setup();
		const res = await app.request('/attachments', jsonRequest('POST', { ...register, path: `someone-else/${FOLDER_ID}/file` }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { details: [{ code: 'invalid_path', field: 'path' }] } });
	});

	it('answers 409 when the path was already registered', async () => {
		const { app, prisma, storage } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TASK_ID }));
		vi.mocked(storage.list).mockResolvedValue(asRow([{ name: 'file' }]));
		vi.mocked(prisma.attachment.create).mockRejectedValue({ code: 'P2002' });
		expect((await app.request('/attachments', jsonRequest('POST', register))).status).toBe(409);
	});

	it.each([
		['no target', { mimeType: 'application/pdf', name: 'a', path: PATH, sizeBytes: 1 }],
		['empty name', { ...register, name: ' ' }],
		['unknown key', { ...register, storagePath: 'x' }],
	])('answers 422 for %s', async (_name, body) => {
		const { app, prisma } = setup();
		expect((await app.request('/attachments', jsonRequest('POST', body))).status).toBe(422);
		expect(prisma.attachment.create).not.toHaveBeenCalled();
	});
});

describe('GET /attachments', () => {
	it('lists the attachments of a target with meta', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([attachment]);
		vi.mocked(prisma.attachment.count).mockResolvedValue(1);
		const res = await app.request(`/attachments?taskId=${TASK_ID}`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [json], meta: { page: 1, pageCount: 1, pageSize: 50, total: 1 } });
		expect(prisma.attachment.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50, where: { ownerId: TEST_USER_ID, taskId: TASK_ID } }));
	});

	it.each(['', `taskId=${TASK_ID}&noteId=${ID}`, 'taskId=nope', `taskId=${TASK_ID}&page=0`])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/attachments?${query}`)).status).toBe(422);
	});
});

describe('GET /attachments/:id/url', () => {
	it('returns a signed read url', async () => {
		const { app, prisma, storage } = setup();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(attachment);
		vi.mocked(storage.readUrl).mockResolvedValue('https://signed');
		const res = await app.request(`/attachments/${ID}/url`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { expiresInSeconds: 3600, url: 'https://signed' } });
	});

	it('answers 404 when not found and 422 for a bad id', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(null);
		expect((await app.request(`/attachments/${ID}/url`)).status).toBe(404);
		expect((await app.request('/attachments/nope/url')).status).toBe(422);
	});
});

describe('DELETE /attachments/:id', () => {
	it('deletes the row and the file', async () => {
		const { app, prisma, storage } = setup();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(attachment);
		const res = await app.request(`/attachments/${ID}`, del);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { id: ID } });
		expect(storage.remove).toHaveBeenCalledWith('private', [PATH]);
	});

	it('answers 404 when not found', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(null);
		expect((await app.request(`/attachments/${ID}`, del)).status).toBe(404);
	});
});
