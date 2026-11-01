import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { nextQuerySchema } from './suggestions.schemas.js';
import { suggestNext } from './suggestions.service.js';

// Read-only. The owner always comes from the verified claims.
export default new Hono<AppEnv>().use(requireUser()).get('/next', zValidator('query', nextQuerySchema, validationHook), async c => {
	const { date, limit } = c.req.valid('query');
	return ok(c, await suggestNext(c.get('prisma'), c.get('claims').sub, date, limit), 200);
});
