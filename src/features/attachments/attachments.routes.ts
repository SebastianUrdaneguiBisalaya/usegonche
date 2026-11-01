import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { attachmentParamSchema, listAttachmentsQuerySchema, registerAttachmentSchema, uploadUrlSchema } from './attachments.schemas.js';
import { createUploadUrl, deleteAttachment, getReadUrl, listAttachments, registerAttachment } from './attachments.service.js';

// Upload flow: 1) POST /upload-url  2) client PUTs the file to Storage  3) POST / with the returned path to record it.
// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireAuth())
	.get('/', zValidator('query', listAttachmentsQuerySchema, validationHook), async c => {
		const { cursor, limit, ...target } = c.req.valid('query');
		const { items, nextCursor } = toPage(await listAttachments(c.get('prisma'), c.get('claims').sub, target, limit, cursor), limit, attachment => attachment.createdAt);
		return okWithMeta(c, items, { limit, nextCursor }, 200);
	})
	.post('/upload-url', zValidator('json', uploadUrlSchema, validationHook), async c => ok(c, await createUploadUrl(c.get('prisma'), c.get('storage'), c.get('claims').sub, c.req.valid('json')), 200))
	.post('/', zValidator('json', registerAttachmentSchema, validationHook), async c =>
		ok(c, await registerAttachment(c.get('prisma'), c.get('storage'), c.get('claims').sub, c.req.valid('json')), 201)
	)
	.get('/:id/url', zValidator('param', attachmentParamSchema, validationHook), async c =>
		ok(c, await getReadUrl(c.get('prisma'), c.get('storage'), c.get('claims').sub, c.req.valid('param').id), 200)
	)
	.delete('/:id', zValidator('param', attachmentParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteAttachment(c.get('prisma'), c.get('storage'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	});
