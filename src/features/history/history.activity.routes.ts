import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { okWithMeta } from '../../lib/http.js';
import { pageMeta } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { historyQuerySchema } from './history.schemas.js';
import { listActivity } from './history.service.js';

// Mounted under `/history`: GET /history, the functional history of every task, newest first. The owner always comes from the verified claims.
export default new Hono<AppEnv>().use(requireUser()).get('/', zValidator('query', historyQuerySchema, validationHook), async c => {
	const { page, pageSize } = c.req.valid('query');
	const { items, total } = await listActivity(c.get('prisma'), c.get('claims').sub, { page, pageSize });
	return okWithMeta(c, items, pageMeta({ page, pageSize }, total), 200);
});
