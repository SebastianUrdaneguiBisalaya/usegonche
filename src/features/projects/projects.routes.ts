import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { pageMeta } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { createProjectSchema, listProjectsQuerySchema, projectParamSchema, updateProjectSchema } from './projects.schemas.js';
import { archiveProject, createProject, getProject, listProjects, unarchiveProject, updateProject } from './projects.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', zValidator('query', listProjectsQuerySchema, validationHook), async c => {
		const { archived, goalId, order, page, pageSize, sort, status, tagId } = c.req.valid('query');
		const { counts, items, total } = await listProjects(c.get('prisma'), c.get('claims').sub, { archived, goalId, order, sort, status, tagId }, { page, pageSize });
		return okWithMeta(c, items, { ...pageMeta({ page, pageSize }, total), counts }, 200);
	})
	.post('/', zValidator('json', createProjectSchema, validationHook), async c => ok(c, await createProject(c.get('prisma'), c.get('claims').sub, c.req.valid('json')), 201))
	.get('/:id', zValidator('param', projectParamSchema, validationHook), async c => ok(c, await getProject(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', projectParamSchema, validationHook), zValidator('json', updateProjectSchema, validationHook), async c =>
		ok(c, await updateProject(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.post('/:id/archive', zValidator('param', projectParamSchema, validationHook), async c => ok(c, await archiveProject(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.post('/:id/unarchive', zValidator('param', projectParamSchema, validationHook), async c => ok(c, await unarchiveProject(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200));
