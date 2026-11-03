import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { timingSafeEqual } from 'hono/utils/buffer';
import type { AppEnv } from '../../env.js';
import { fail, ok } from '../../lib/http.js';
import { processDueReminders } from './reminders.service.js';

export const SECRET_HEADER = 'x-internal-secret';

/**
 * Called by the Supabase `pg_cron` job (see `packages/database/prisma/manual/reminders-pg-cron.sql`), not by clients.
 * Mounted in `app.ts` outside `requireAuth` and outside `routes.ts`, so it is not part of the public RPC client types.
 * Guarded by a shared secret compared in constant time; no configured secret means everything is refused.
 */
export default new Hono<AppEnv>().post('/process', async c => {
	const secret = env(c).INTERNAL_CRON_SECRET;
	const given = c.req.header(SECRET_HEADER);
	if (!secret || !given || !(await timingSafeEqual(given, secret))) return fail(c, 'unauthorized', 401);
	return ok(c, await processDueReminders(c.get('prisma')), 200);
});
