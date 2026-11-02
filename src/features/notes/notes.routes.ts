import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { pageMeta } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { getRevision, listRevisions } from './notes.revisions.service.js';
import { createNoteSchema, listNotesQuerySchema, listRevisionsQuerySchema, noteParamSchema, revisionParamSchema, updateNoteSchema } from './notes.schemas.js';
import { createNote, deleteNote, getNote, listNotes, restoreRevision, updateNote } from './notes.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', zValidator('query', listNotesQuerySchema, validationHook), async c => {
		const { page, pageSize, ...filters } = c.req.valid('query');
		const { items, total } = await listNotes(c.get('prisma'), c.get('claims').sub, filters, { page, pageSize });
		return okWithMeta(c, items, pageMeta({ page, pageSize }, total), 200);
	})
	.post('/', zValidator('json', createNoteSchema, validationHook), async c => ok(c, await createNote(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.get('/:id', zValidator('param', noteParamSchema, validationHook), async c => ok(c, await getNote(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', noteParamSchema, validationHook), zValidator('json', updateNoteSchema, validationHook), async c =>
		ok(c, await updateNote(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.delete('/:id', zValidator('param', noteParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteNote(c.get('prisma'), c.get('storage'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	})
	.get('/:id/revisions', zValidator('param', noteParamSchema, validationHook), zValidator('query', listRevisionsQuerySchema, validationHook), async c => {
		const { page, pageSize } = c.req.valid('query');
		const { items, total } = await listRevisions(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, { page, pageSize });
		return okWithMeta(c, items, pageMeta({ page, pageSize }, total), 200);
	})
	.get('/:id/revisions/:revisionId', zValidator('param', revisionParamSchema, validationHook), async c => {
		const { id, revisionId } = c.req.valid('param');
		return ok(c, await getRevision(c.get('prisma'), c.get('claims').sub, id, revisionId), 200);
	})
	.post('/:id/revisions/:revisionId/restore', zValidator('param', revisionParamSchema, validationHook), async c => {
		const { id, revisionId } = c.req.valid('param');
		return ok(c, await restoreRevision(c.get('prisma'), c.get('claims').sub, id, revisionId), 200);
	});
