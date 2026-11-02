import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { searchQuerySchema } from './search.schemas.js';
import { search } from './search.service.js';

// Read-only. The owner always comes from the verified claims.
export default new Hono<AppEnv>().use(requireUser()).get('/', zValidator('query', searchQuerySchema, validationHook), async c => {
	const { cursor, limit, q, types } = c.req.valid('query');
	const { items, nextCursor } = toPage(await search(c.get('prisma'), c.get('claims').sub, q, types, limit, cursor), limit, hit => hit.updatedAt);
	return okWithMeta(c, items, { limit, nextCursor }, 200);
});
