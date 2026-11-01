import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok, okWithMeta } from '../../lib/http.js';
import { toPage } from '../../lib/pagination.js';
import { validationHook } from '../../lib/validator.js';
import { applyDecisions } from './reviews.decisions.service.js';
import { closeReviewSchema, decisionsSchema, listReviewsQuerySchema, openReviewSchema, reviewParamSchema, updateReviewSchema } from './reviews.schemas.js';
import { closeReview, getReview, listReviews, openReview, updateReview } from './reviews.service.js';

// The owner always comes from the verified claims, never from the body.
export default new Hono<AppEnv>()
	.use(requireAuth())
	.get('/', zValidator('query', listReviewsQuerySchema, validationHook), async c => {
		const { cursor, limit, ...filters } = c.req.valid('query');
		const { items, nextCursor } = toPage(await listReviews(c.get('prisma'), c.get('claims').sub, filters, limit, cursor), limit, review => review.periodStart);
		return okWithMeta(c, items, { limit, nextCursor }, 200);
	})
	.post('/', zValidator('json', openReviewSchema, validationHook), async c => {
		const { created, review } = await openReview(c.get('prisma'), c.get('claims').sub, c.req.valid('json'));
		return created ? ok(c, review, 201) : ok(c, review, 200);
	})
	.get('/:id', zValidator('param', reviewParamSchema, validationHook), async c => ok(c, await getReview(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id), 200))
	.patch('/:id', zValidator('param', reviewParamSchema, validationHook), zValidator('json', updateReviewSchema, validationHook), async c =>
		ok(c, await updateReview(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	)
	.post('/:id/decisions', zValidator('param', reviewParamSchema, validationHook), zValidator('json', decisionsSchema, validationHook), async c =>
		ok(c, await applyDecisions(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json').decisions), 201)
	)
	.post('/:id/close', zValidator('param', reviewParamSchema, validationHook), zValidator('json', closeReviewSchema, validationHook), async c =>
		ok(c, await closeReview(c.get('prisma'), c.get('claims').sub, c.req.valid('param').id, c.req.valid('json')), 200)
	);
