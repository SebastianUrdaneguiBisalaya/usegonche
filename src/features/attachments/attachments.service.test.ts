import type { Attachment } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createMockStorage, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { attachmentPaths, createUploadUrl, deleteAttachment, getReadUrl, listAttachments, registerAttachment, removeFiles } from './attachments.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TASK_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const FOLDER_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const PATH = `${TEST_USER_ID}/${FOLDER_ID}/file`;
const attachment = { id: ID, ownerId: TEST_USER_ID, storagePath: PATH, taskId: TASK_ID } as Attachment;
const input = { mimeType: 'application/pdf', name: 'spec.pdf', path: PATH, sizeBytes: 1024, taskId: TASK_ID };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('createUploadUrl', () => {
	it('checks the target and returns a signed upload url under the owner folder', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TASK_ID }));
		vi.mocked(storage.uploadUrl).mockResolvedValue({ path: 'p', token: 't', uploadUrl: 'u', visibility: 'private' });

		expect(await createUploadUrl(prisma, storage, TEST_USER_ID, { mimeType: 'image/png', sizeBytes: 10, taskId: TASK_ID })).toMatchObject({ token: 't' });
		expect(prisma.task.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { id: TASK_ID, ownerId: TEST_USER_ID } });
		expect(storage.uploadUrl).toHaveBeenCalledWith('private', expect.stringMatching(new RegExp(`^${TEST_USER_ID}/[0-9a-f-]{36}/file$`)));
	});

	it.each([
		['projectId', 'project'],
		['noteId', 'note'],
	] as const)('checks %s against its own table', async (field, model) => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma[model].findFirst).mockResolvedValue(null);
		expect(await rejection(createUploadUrl(prisma, storage, TEST_USER_ID, { [field]: TASK_ID, mimeType: 'image/png', sizeBytes: 10 }))).toMatchObject({
			details: [{ code: 'not_found', field }],
			status: 422,
		});
		expect(storage.uploadUrl).not.toHaveBeenCalled();
	});

	it('rejects a target that is not the owner’s with 422', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(createUploadUrl(prisma, storage, OTHER_USER_ID, { mimeType: 'image/png', sizeBytes: 10, taskId: TASK_ID }))).toMatchObject({ status: 422 });
		expect(storage.uploadUrl).not.toHaveBeenCalled();
	});
});

describe('registerAttachment', () => {
	const setup = () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ id: TASK_ID }));
		vi.mocked(storage.list).mockResolvedValue(asRow([{ name: 'file' }]));
		vi.mocked(prisma.attachment.create).mockResolvedValue(attachment);
		return { prisma, storage };
	};

	it('records the metadata after checking the file exists in storage', async () => {
		const { prisma, storage } = setup();
		expect(await registerAttachment(prisma, storage, TEST_USER_ID, input)).toBe(attachment);
		expect(storage.list).toHaveBeenCalledWith('private', `${TEST_USER_ID}/${FOLDER_ID}`);
		expect(prisma.attachment.create).toHaveBeenCalledWith({
			data: { mimeType: 'application/pdf', name: 'spec.pdf', noteId: undefined, ownerId: TEST_USER_ID, projectId: undefined, sizeBytes: 1024, storagePath: PATH, taskId: TASK_ID },
		});
	});

	it.each([
		['another owner’s folder', `${OTHER_USER_ID}/${FOLDER_ID}/file`],
		['a different file name', `${TEST_USER_ID}/${FOLDER_ID}/other`],
		['a deeper path', `${TEST_USER_ID}/${FOLDER_ID}/file/x`],
		['a path without folder', `${TEST_USER_ID}/file`],
	])('rejects %s with 422', async (_name, path) => {
		const { prisma, storage } = setup();
		expect(await rejection(registerAttachment(prisma, storage, TEST_USER_ID, { ...input, path }))).toMatchObject({ details: [{ code: 'invalid_path', field: 'path' }], status: 422 });
		expect(prisma.attachment.create).not.toHaveBeenCalled();
	});

	it('rejects a file that was not uploaded', async () => {
		const { prisma, storage } = setup();
		vi.mocked(storage.list).mockResolvedValue([]);
		expect(await rejection(registerAttachment(prisma, storage, TEST_USER_ID, input))).toMatchObject({ details: [{ code: 'not_uploaded', field: 'path' }], status: 422 });
		expect(prisma.attachment.create).not.toHaveBeenCalled();
	});

	it('rejects a target that is not the owner’s', async () => {
		const { prisma, storage } = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(registerAttachment(prisma, storage, TEST_USER_ID, input))).toMatchObject({ details: [{ code: 'not_found', field: 'taskId' }], status: 422 });
	});

	it('answers 409 when the path was already registered', async () => {
		const { prisma, storage } = setup();
		vi.mocked(prisma.attachment.create).mockRejectedValue({ code: 'P2002' });
		expect(await rejection(registerAttachment(prisma, storage, TEST_USER_ID, input))).toMatchObject({ code: 'already_exists', status: 409 });
	});
});

describe('listAttachments', () => {
	it('lists the attachments of one target scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([attachment]);
		vi.mocked(prisma.attachment.count).mockResolvedValue(1);
		expect(await listAttachments(prisma, TEST_USER_ID, { noteId: ID }, { page: 1, pageSize: 20 })).toEqual({ items: [attachment], total: 1 });
		expect(prisma.attachment.findMany).toHaveBeenCalledWith({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20, where: { noteId: ID, ownerId: TEST_USER_ID } });
	});
});

describe('getReadUrl', () => {
	it('returns a signed read url for the owner’s attachment', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(attachment);
		vi.mocked(storage.readUrl).mockResolvedValue('https://signed');
		expect(await getReadUrl(prisma, storage, TEST_USER_ID, ID)).toEqual({ expiresInSeconds: 3600, url: 'https://signed' });
		expect(storage.readUrl).toHaveBeenCalledWith('private', PATH, 3600);
	});

	it('throws 404 for another owner and signs nothing', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(null);
		expect(await rejection(getReadUrl(prisma, storage, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(storage.readUrl).not.toHaveBeenCalled();
	});
});

describe('deleteAttachment', () => {
	it('deletes the row then the file', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(attachment);
		await deleteAttachment(prisma, storage, TEST_USER_ID, ID);
		expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
		expect(storage.remove).toHaveBeenCalledWith('private', [PATH]);
	});

	it('throws 404 for another owner and deletes nothing', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.attachment.findFirst).mockResolvedValue(null);
		expect(await rejection(deleteAttachment(prisma, storage, OTHER_USER_ID, ID))).toMatchObject({ status: 404 });
		expect(prisma.attachment.deleteMany).not.toHaveBeenCalled();
		expect(storage.remove).not.toHaveBeenCalled();
	});
});

describe('removeFiles / attachmentPaths', () => {
	it('does nothing without paths and swallows storage errors', async () => {
		const storage = createMockStorage();
		await removeFiles(storage, []);
		expect(storage.remove).not.toHaveBeenCalled();

		vi.mocked(storage.remove).mockRejectedValue(new Error('boom'));
		const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		await expect(removeFiles(storage, ['a'])).resolves.toBeUndefined();
		spy.mockRestore();
	});

	it('collects the owner’s paths', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.attachment.findMany).mockResolvedValue(asRow([{ storagePath: 'a' }, { storagePath: 'b' }]));
		expect(await attachmentPaths(prisma, TEST_USER_ID, { noteId: ID })).toEqual(['a', 'b']);
		expect(prisma.attachment.findMany).toHaveBeenCalledWith({ select: { storagePath: true }, where: { noteId: ID, ownerId: TEST_USER_ID } });
	});
});
