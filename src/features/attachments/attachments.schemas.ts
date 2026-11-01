import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

const mimeType = z
	.string()
	.trim()
	.max(127)
	.regex(/^[\w.+-]+\/[\w.+-]+$/, 'invalid_mime_type');
const sizeBytes = z.number().int().min(1).max(ATTACHMENT_MAX_BYTES);

/** An attachment belongs to exactly one of task, project or note. */
const target = {
	noteId: z.uuid().optional(),
	projectId: z.uuid().optional(),
	taskId: z.uuid().optional(),
};
const exactlyOne = (value: { noteId?: string; projectId?: string; taskId?: string }) => [value.noteId, value.projectId, value.taskId].filter(Boolean).length === 1;
const exactlyOneIssue = { message: 'exactly_one_target', path: ['taskId'] };

export const uploadUrlSchema = z.strictObject({ ...target, mimeType, sizeBytes }).refine(exactlyOne, exactlyOneIssue);

/** `path` is the one returned by the upload-url step; the file must already be uploaded. */
export const registerAttachmentSchema = z
	.strictObject({
		...target,
		mimeType,
		name: z.string().trim().min(1).max(255),
		path: z.string().max(300),
		sizeBytes,
	})
	.refine(exactlyOne, exactlyOneIssue);

export const listAttachmentsQuerySchema = z.object({ ...paginationQuery, ...target }).refine(exactlyOne, exactlyOneIssue);

export const attachmentParamSchema = z.object({ id: z.uuid() });

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
export type RegisterAttachmentInput = z.infer<typeof registerAttachmentSchema>;
export type AttachmentTarget = { noteId?: string; projectId?: string; taskId?: string };
