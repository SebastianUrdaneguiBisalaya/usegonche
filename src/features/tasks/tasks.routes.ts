import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { createBlocker, listBlockers, resolveBlocker } from './tasks.blockers.service.js';
import { addDependency, removeDependency } from './tasks.dependencies.service.js';
import { addDependencySchema, blockerParamSchema, createBlockerSchema, createTaskSchema, dependencyParamSchema, listTasksQuerySchema, taskParamSchema, updateTaskSchema } from './tasks.schemas.js';
import { createTask, deleteTask, getTask, listTasks, updateTask } from './tasks.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireAuth())
	.get('/', zValidator('query', listTasksQuerySchema, validationHook), async c => {
		const { cursor, limit, ...filters } = c.req.valid('query');
		const { items, nextCursor } = toPage(await listTasks(c.get('prisma'), c.get('claims').sub, filters, limit, cursor), limit, task => task.createdAt);
		return okWithMeta(c, items, { limit, nextCursor }, 200);
	})
	.post('/', zValidator('json', createTaskSchema, validationHook), async c => ok(c, await createTask(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.get('/:id', zValidator('param', taskParamSchema, validationHook), async c => ok(c, await getTask(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', taskParamSchema, validationHook), zValidator('json', updateTaskSchema, validationHook), async c =>
		ok(c, await updateTask(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.delete('/:id', zValidator('param', taskParamSchema, validationHook), async c => {
		const { id } = c.req.valid('param');
		await deleteTask(c.get('prisma'), c.get('claims').sub, id);
		return ok(c, { id }, 200);
	})
	.post('/:id/dependencies', zValidator('param', taskParamSchema, validationHook), zValidator('json', addDependencySchema, validationHook), async c =>
		ok(c, await addDependency(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json').dependsOnId), 200)
	)
	.delete('/:id/dependencies/:dependsOnId', zValidator('param', dependencyParamSchema, validationHook), async c => {
		const { dependsOnId, id } = c.req.valid('param');
		return ok(c, await removeDependency(c.get('prisma'), c.get('claims').sub, id, dependsOnId), 200);
	})
	.get('/:id/blockers', zValidator('param', taskParamSchema, validationHook), async c => ok(c, await listBlockers(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.post('/:id/blockers', zValidator('param', taskParamSchema, validationHook), zValidator('json', createBlockerSchema, validationHook), async c =>
		ok(c, await createBlocker(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json').reason), 201)
	)
	.post('/:id/blockers/:blockerId/resolve', zValidator('param', blockerParamSchema, validationHook), async c => {
		const { blockerId, id } = c.req.valid('param');
		return ok(c, await resolveBlocker(c.get('prisma'), c.get('claims').sub, id, blockerId), 200);
	});
