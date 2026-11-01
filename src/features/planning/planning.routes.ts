import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { getAvailability, setAvailability } from './planning.availability.service.js';
import { createBlock, deleteBlock, listBlocks, moveBlock, updateBlock } from './planning.blocks.service.js';
import { getDay, setDayItems } from './planning.days.service.js';
import { createEvent, deleteEvent, listEvents, updateEvent } from './planning.events.service.js';
import { proposeReplan } from './planning.replan.service.js';
import {
	createBlockSchema,
	createEventSchema,
	dateParamSchema,
	idParamSchema,
	listBlocksQuerySchema,
	listEventsQuerySchema,
	moveBlockSchema,
	replanQuerySchema,
	setAvailabilitySchema,
	setDayItemsSchema,
	updateBlockSchema,
	updateEventSchema,
} from './planning.schemas.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireAuth())
	.get('/availability', async c => ok(c, await getAvailability(c.get('prisma'), c.get('claims').sub), 200))
	.put('/availability', zValidator('json', setAvailabilitySchema, validationHook), async c => ok(c, await setAvailability(c.get('prisma'), c.get('claims').sub, c.req.valid('json').windows), 200))
	.get('/events', zValidator('query', listEventsQuerySchema, validationHook), async c => {
		const { from, to } = c.req.valid('query');
		return ok(c, await listEvents(c.get('prisma'), c.get('claims').sub, from, to), 200);
	})
	.post('/events', zValidator('json', createEventSchema, validationHook), async c => ok(c, await createEvent(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.patch('/events/:id', zValidator('param', idParamSchema, validationHook), zValidator('json', updateEventSchema, validationHook), async c =>
		ok(c, await updateEvent(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.delete('/events/:id', zValidator('param', idParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteEvent(c.get('prisma'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	})
	.get('/days/:date', zValidator('param', dateParamSchema, validationHook), async c => ok(c, await getDay(c.get('prisma'), c.get('claims').sub, c.req.valid('param').date), 200))
	.put('/days/:date/items', zValidator('param', dateParamSchema, validationHook), zValidator('json', setDayItemsSchema, validationHook), async c =>
		ok(c, await setDayItems(c.get('prisma'), c.get('claims').sub, c.req.valid('param').date, c.req.valid('json').taskIds), 200)
	)
	.get('/blocks', zValidator('query', listBlocksQuerySchema, validationHook), async c => {
		const { from, status, to } = c.req.valid('query');
		return ok(c, await listBlocks(c.get('prisma'), c.get('claims').sub, from, to, status), 200);
	})
	.post('/blocks', zValidator('json', createBlockSchema, validationHook), async c => ok(c, await createBlock(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.patch('/blocks/:id', zValidator('param', idParamSchema, validationHook), zValidator('json', updateBlockSchema, validationHook), async c =>
		ok(c, await updateBlock(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.post('/blocks/:id/move', zValidator('param', idParamSchema, validationHook), zValidator('json', moveBlockSchema, validationHook), async c =>
		ok(c, await moveBlock(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 201)
	)
	.delete('/blocks/:id', zValidator('param', idParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteBlock(c.get('prisma'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	})
	.get('/replan-proposals', zValidator('query', replanQuerySchema, validationHook), async c => {
		const { date, days } = c.req.valid('query');
		return ok(c, await proposeReplan(c.get('prisma'), c.get('claims').sub, date, days), 200);
	});
