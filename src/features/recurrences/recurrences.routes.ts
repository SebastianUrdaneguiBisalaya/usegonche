import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { createRecurrenceSchema, listRecurrencesQuerySchema, recurrenceParamSchema, updateRecurrenceSchema } from './recurrences.schemas.js';
import { createRecurrence, deleteRecurrence, getRecurrence, getToday, listRecurrences, materializeRecurrence, updateRecurrence } from './recurrences.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', zValidator('query', listRecurrencesQuerySchema, validationHook), async c => {
		const { cursor, limit } = c.req.valid('query');
		const { items, nextCursor } = toPage(await listRecurrences(c.get('prisma'), c.get('claims').sub, limit, cursor), limit, rule => rule.createdAt);
		return okWithMeta(c, items, { limit, nextCursor }, 200);
	})
	.post('/', zValidator('json', createRecurrenceSchema, validationHook), async c => {
		const prisma = c.get('prisma');
		const ownerId = c.get('claims').sub;
		return ok(c, await createRecurrence(prisma, ownerId, c.req.valid('json'), await getToday(prisma, ownerId)), 201);
	})
	.get('/:id', zValidator('param', recurrenceParamSchema, validationHook), async c => ok(c, await getRecurrence(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', recurrenceParamSchema, validationHook), zValidator('json', updateRecurrenceSchema, validationHook), async c => {
		const prisma = c.get('prisma');
		const ownerId = c.get('claims').sub;
		return ok(c, await updateRecurrence(prisma, ownerId, c.req.valid('param').id, c.req.valid('json'), await getToday(prisma, ownerId)), 200);
	})
	.delete('/:id', zValidator('param', recurrenceParamSchema, validationHook), async c => {
		const prisma = c.get('prisma');
		const ownerId = c.get('claims').sub;
		const { id } = c.req.valid('param');
		await deleteRecurrence(prisma, ownerId, id, await getToday(prisma, ownerId));
		return ok(c, { id }, 200);
	})
	.post('/:id/materialize', zValidator('param', recurrenceParamSchema, validationHook), async c => {
		const prisma = c.get('prisma');
		const ownerId = c.get('claims').sub;
		return ok(c, await materializeRecurrence(prisma, ownerId, c.req.valid('param').id, await getToday(prisma, ownerId)), 200);
	});
