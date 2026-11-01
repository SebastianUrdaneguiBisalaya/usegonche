import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { brainDumpSchema, captureSchema, inboxParamSchema, listQuerySchema, setStatusSchema } from './inbox.schemas.js';
import { brainDump, captureItem, listItems, setStatus } from './inbox.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireAuth())
	.get('/', zValidator('query', listQuerySchema, validationHook), async c => {
		const { limit, status } = c.req.valid('query');
		return okWithMeta(c, await listItems(c.get('prisma'), c.get('claims').sub, status, limit), { limit, status }, 200);
	})
	.post('/', zValidator('json', captureSchema, validationHook), async c => ok(c, await captureItem(c.get('prisma'), c.get('claims').sub, c.req.valid('json').content), 201))
	.post('/brain-dump', zValidator('json', brainDumpSchema, validationHook), async c => ok(c, await brainDump(c.get('prisma'), c.get('claims').sub, c.req.valid('json').text), 201))
	.patch('/:id', zValidator('param', inboxParamSchema, validationHook), zValidator('json', setStatusSchema, validationHook), async c =>
		ok(c, await setStatus(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json').status), 200)
	);
