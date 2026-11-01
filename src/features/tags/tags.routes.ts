import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { createTagSchema, tagParamSchema, updateTagSchema } from './tags.schemas.js';
import { createTag, deleteTag, listTags, renameTag } from './tags.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireAuth())
	.get('/', async c => ok(c, await listTags(c.get('prisma'), c.get('claims').sub), 200))
	.post('/', zValidator('json', createTagSchema, validationHook), async c => ok(c, await createTag(c.get('prisma'), c.get('claims').sub, c.req.valid('json').name), 201))
	.patch('/:id', zValidator('param', tagParamSchema, validationHook), zValidator('json', updateTagSchema, validationHook), async c =>
		ok(c, await renameTag(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json').name), 200)
	)
	.delete('/:id', zValidator('param', tagParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteTag(c.get('prisma'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	});
