import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { createTemplateSchema, instantiateTemplateSchema, listTemplatesQuerySchema, templateParamSchema, updateTemplateSchema } from './templates.schemas.js';
import { createTemplate, deleteTemplate, getTemplate, instantiateTemplate, listTemplates, updateTemplate } from './templates.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', zValidator('query', listTemplatesQuerySchema, validationHook), async c => {
		const { cursor, kind, limit } = c.req.valid('query');
		const { items, nextCursor } = toPage(await listTemplates(c.get('prisma'), c.get('claims').sub, kind, limit, cursor), limit, template => template.createdAt);
		return okWithMeta(c, items, { limit, nextCursor }, 200);
	})
	.post('/', zValidator('json', createTemplateSchema, validationHook), async c => ok(c, await createTemplate(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.get('/:id', zValidator('param', templateParamSchema, validationHook), async c => ok(c, await getTemplate(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', templateParamSchema, validationHook), zValidator('json', updateTemplateSchema, validationHook), async c =>
		ok(c, await updateTemplate(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.delete('/:id', zValidator('param', templateParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteTemplate(c.get('prisma'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	})
	.post('/:id/instantiate', zValidator('param', templateParamSchema, validationHook), zValidator('json', instantiateTemplateSchema, validationHook), async c =>
		ok(c, await instantiateTemplate(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 201)
	);
