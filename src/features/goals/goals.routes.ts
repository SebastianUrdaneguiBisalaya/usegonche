import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { pageMeta } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { createGoalSchema, goalParamSchema, listGoalsQuerySchema, updateGoalSchema } from './goals.schemas.js';
import { archiveGoal, createGoal, getGoal, listGoals, unarchiveGoal, updateGoal } from './goals.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', zValidator('query', listGoalsQuerySchema, validationHook), async c => {
		const { archived, page, pageSize, status } = c.req.valid('query');
		const { items, total } = await listGoals(c.get('prisma'), c.get('claims').sub, { archived, status }, { page, pageSize });
		return okWithMeta(c, items, pageMeta({ page, pageSize }, total), 200);
	})
	.post('/', zValidator('json', createGoalSchema, validationHook), async c => ok(c, await createGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.get('/:id', zValidator('param', goalParamSchema, validationHook), async c => ok(c, await getGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', goalParamSchema, validationHook), zValidator('json', updateGoalSchema, validationHook), async c =>
		ok(c, await updateGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.post('/:id/archive', zValidator('param', goalParamSchema, validationHook), async c => ok(c, await archiveGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.post('/:id/unarchive', zValidator('param', goalParamSchema, validationHook), async c => ok(c, await unarchiveGoal(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200));
