import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { pageMeta } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { createTagSchema, listTagsQuerySchema, tagParamSchema, updateTagSchema } from './tags.schemas.js';
import { createTag, deleteTag, listTags, updateTag } from './tags.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', zValidator('query', listTagsQuerySchema, validationHook), async c => {
		const { order, page, pageSize, q, sort } = c.req.valid('query');
		const { items, total } = await listTags(c.get('prisma'), c.get('claims').sub, { order, q, sort }, { page, pageSize });
		return okWithMeta(c, items, pageMeta({ page, pageSize }, total), 200);
	})
	.post('/', zValidator('json', createTagSchema, validationHook), async c => ok(c, await createTag(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.patch('/:id', zValidator('param', tagParamSchema, validationHook), zValidator('json', updateTagSchema, validationHook), async c =>
		ok(c, await updateTag(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.delete('/:id', zValidator('param', tagParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteTag(c.get('prisma'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	});
