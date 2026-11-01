import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { historyParamSchema, historyQuerySchema } from './history.schemas.js';
import { listTaskHistory } from './history.service.js';

// Mounted under `/tasks`: GET /tasks/:id/history. The owner always comes from the verified claims.
export default new Hono<AppEnv>().use(requireAuth()).get('/:id/history', zValidator('param', historyParamSchema, validationHook), zValidator('query', historyQuerySchema, validationHook), async c => {
	const { cursor, limit } = c.req.valid('query');
	const { items, nextCursor } = toPage(await listTaskHistory(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, limit, cursor), limit, event => event.occurredAt);
	return okWithMeta(c, items, { limit, nextCursor }, 200);
});
