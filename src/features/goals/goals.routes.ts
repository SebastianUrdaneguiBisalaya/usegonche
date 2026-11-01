import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { createGoalSchema, goalParamSchema, listGoalsQuerySchema, updateGoalSchema } from './goals.schemas.js';
import { archiveGoal, createGoal, getGoal, listGoals, unarchiveGoal, updateGoal } from './goals.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireAuth())
	.get('/', zValidator('query', listGoalsQuerySchema, validationHook), async c => {
		const { archived, cursor, limit, status } = c.req.valid('query');
		const { items, nextCursor } = toPage(await listGoals(c.get('prisma'), c.get('claims').sub, { archived, status }, limit, cursor), limit, goal => goal.createdAt);
		return okWithMeta(c, items, { limit, nextCursor }, 200);
	})
	.post('/', zValidator('json', createGoalSchema, validationHook), async c => ok(c, await createGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.get('/:id', zValidator('param', goalParamSchema, validationHook), async c => ok(c, await getGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', goalParamSchema, validationHook), zValidator('json', updateGoalSchema, validationHook), async c =>
		ok(c, await updateGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.post('/:id/archive', zValidator('param', goalParamSchema, validationHook), async c => ok(c, await archiveGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.post('/:id/unarchive', zValidator('param', goalParamSchema, validationHook), async c => ok(c, await unarchiveGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200));
