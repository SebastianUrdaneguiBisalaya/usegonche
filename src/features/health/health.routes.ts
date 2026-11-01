import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok } from '../../lib/http.js';

export default new Hono<AppEnv>().get('/', async c => {
	await c.get('prisma').$queryRaw`SELECT 1`;
	return ok(c, { ok: true });
});
