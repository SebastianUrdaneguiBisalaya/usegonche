import { requireAuth } from '@usegonche/auth/hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env.js';
import { rateLimit } from './rate-limit.js';

/**
 * `requireAuth()` plus the per-user rate limit. Use it at the router level of every protected feature: the limit is keyed by the
 * verified user id, so it only counts requests that already passed authentication.
 */
export const requireUser = () => {
	const authenticate = requireAuth();
	const limit = rateLimit('user');
	return createMiddleware<AppEnv>(async (c, next) => {
		let response: Response | undefined;
		await authenticate(c, async () => {
			response = (await limit(c, next)) ?? undefined;
		});
		if (response) return response;
	});
};
