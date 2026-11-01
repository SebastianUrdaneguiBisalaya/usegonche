import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { getBlockers, getDistribution, getRhythm } from './metrics.breakdowns.service.js';
import { getFocusTime, getPlanningReliability, getThroughput } from './metrics.charts.service.js';
import { rangeQuerySchema, throughputQuerySchema } from './metrics.schemas.js';
import { getSummary } from './metrics.summary.service.js';

// Read-only; the owner always comes from the verified claims. Every metric is computed on read from real data.
export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/summary', zValidator('query', rangeQuerySchema, validationHook), async c => ok(c, await getSummary(c.get('prisma'), c.get('claims').sub, c.req.valid('query')), 200))
	.get('/throughput', zValidator('query', throughputQuerySchema, validationHook), async c => ok(c, await getThroughput(c.get('prisma'), c.get('claims').sub, c.req.valid('query')), 200))
	.get('/focus-time', zValidator('query', rangeQuerySchema, validationHook), async c => ok(c, await getFocusTime(c.get('prisma'), c.get('claims').sub, c.req.valid('query')), 200))
	.get('/planning', zValidator('query', rangeQuerySchema, validationHook), async c => ok(c, await getPlanningReliability(c.get('prisma'), c.get('claims').sub, c.req.valid('query')), 200))
	.get('/distribution', zValidator('query', rangeQuerySchema, validationHook), async c => ok(c, await getDistribution(c.get('prisma'), c.get('claims').sub, c.req.valid('query')), 200))
	.get('/blockers', zValidator('query', rangeQuerySchema, validationHook), async c => ok(c, await getBlockers(c.get('prisma'), c.get('claims').sub, c.req.valid('query')), 200))
	.get('/rhythm', zValidator('query', rangeQuerySchema, validationHook), async c => ok(c, await getRhythm(c.get('prisma'), c.get('claims').sub, c.req.valid('query')), 200));
