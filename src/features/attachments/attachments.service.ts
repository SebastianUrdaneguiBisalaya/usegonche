import type { Attachment, Prisma, PrismaClient } from '@usegonche/database';
import type { Storage, UploadUrl } from '@usegonche/storage';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import { createOwnerUploadUrl } from '../../lib/upload-url.js';
import type { AttachmentTarget, RegisterAttachmentInput, UploadUrlInput } from './attachments.schemas.js';

/** Attachments always live in the private bucket. Layout: `<ownerId>/<uuid>/file` (the original name is kept in the database). */
const VISIBILITY = 'private' as const;
const FILE_NAME = 'file';
const READ_URL_SECONDS = 3600;

const targetField = ({ projectId, taskId }: AttachmentTarget): 'noteId' | 'projectId' | 'taskId' => (taskId ? 'taskId' : projectId ? 'projectId' : 'noteId');

/** The target must exist and belong to the owner. */
const assertTarget = async (prisma: PrismaClient, ownerId: string, target: AttachmentTarget): Promise<void> => {
	const field = targetField(target);
	const where = scoped(ownerId, { id: target[field] });
	const found =
		field === 'taskId'
			? await prisma.task.findFirst({ select: { id: true }, where })
			: field === 'projectId'
				? await prisma.project.findFirst({ select: { id: true }, where })
				: await prisma.note.findFirst({ select: { id: true }, where });
	if (!found) throw new AppError('validation_error', 422, [{ code: 'not_found', field }]);
};

/** Step 1: signed URL for the client to upload the file straight to Storage. Nothing is stored in the database yet. */
export const createUploadUrl = async (prisma: PrismaClient, storage: Storage, ownerId: string, input: UploadUrlInput): Promise<UploadUrl> => {
	await assertTarget(prisma, ownerId, input);
	return createOwnerUploadUrl(storage, ownerId, { filename: FILE_NAME, visibility: VISIBILITY });
};

/** Step 3 (after the upload): records the metadata. The path must be one of the owner's and the file must exist in Storage. */
export const registerAttachment = async (prisma: PrismaClient, storage: Storage, ownerId: string, input: RegisterAttachmentInput): Promise<Attachment> => {
	const [folderOwner, folderId, file, ...rest] = input.path.split('/');
	const invalidPath = (code: string) => new AppError('validation_error', 422, [{ code, field: 'path' }]);
	if (folderOwner !== ownerId || !folderId || file !== FILE_NAME || rest.length > 0) throw invalidPath('invalid_path');
	await assertTarget(prisma, ownerId, input);
	const uploaded = await storage.list(VISIBILITY, `${folderOwner}/${folderId}`);
	if (!uploaded.some(object => object.name === FILE_NAME)) throw invalidPath('not_uploaded');

	try {
		return await prisma.attachment.create({
			data: { mimeType: input.mimeType, name: input.name, noteId: input.noteId, ownerId, projectId: input.projectId, sizeBytes: input.sizeBytes, storagePath: input.path, taskId: input.taskId },
		});
	} catch (error) {
		if (isUniqueViolation(error)) throw new AppError('already_exists', 409);
		throw error;
	}
};

/** One page of attachments of one target (newest first) with the total. */
export const listAttachments = async (prisma: PrismaClient, ownerId: string, target: AttachmentTarget, page: PageParams): Promise<Paged<Attachment>> => {
	const field = targetField(target);
	const where = scoped(ownerId, { [field]: target[field] });
	const [items, total] = await Promise.all([prisma.attachment.findMany({ orderBy: pageOrder('createdAt'), ...pageArgs(page), where }), prisma.attachment.count({ where })]);
	return { items, total };
};

const findOwned = async (prisma: PrismaClient, ownerId: string, id: string): Promise<Attachment> => {
	const attachment = await prisma.attachment.findFirst({ where: scoped(ownerId, { id }) });
	if (!attachment) throw new AppError('not_found', 404);
	return attachment;
};

/** Short-lived signed URL to download the file directly from Storage. */
export const getReadUrl = async (prisma: PrismaClient, storage: Storage, ownerId: string, id: string): Promise<{ expiresInSeconds: number; url: string }> => {
	const attachment = await findOwned(prisma, ownerId, id);
	return { expiresInSeconds: READ_URL_SECONDS, url: await storage.readUrl(VISIBILITY, attachment.storagePath, READ_URL_SECONDS) };
};

/** Best effort: the database is the source of truth, so a failed Storage delete leaves an orphan file, never a dangling row. */
export const removeFiles = async (storage: Storage, paths: string[]): Promise<void> => {
	if (paths.length === 0) return;
	try {
		await storage.remove(VISIBILITY, paths);
	} catch (error) {
		console.error('Could not remove attachment files', error);
	}
};

/** Storage paths of the owner's attachments matching `where`; call it before deleting a parent whose rows cascade. */
export const attachmentPaths = async (prisma: PrismaClient | Prisma.TransactionClient, ownerId: string, where: Prisma.AttachmentWhereInput): Promise<string[]> =>
	(await prisma.attachment.findMany({ select: { storagePath: true }, where: scoped(ownerId, where) })).map(attachment => attachment.storagePath);

export const deleteAttachment = async (prisma: PrismaClient, storage: Storage, ownerId: string, id: string): Promise<void> => {
	const attachment = await findOwned(prisma, ownerId, id);
	await prisma.attachment.deleteMany({ where: scoped(ownerId, { id }) });
	await removeFiles(storage, [attachment.storagePath]);
};
