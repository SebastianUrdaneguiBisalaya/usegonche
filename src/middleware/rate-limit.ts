import type { Context } from 'hono';
import { env, getRuntimeKey } from 'hono/adapter';
import { createMiddleware } from 'hono/factory';
import { rateLimiter } from 'hono-rate-limiter';
import type { AppEnv, Bindings, RateLimitBinding } from '../env.js';
import { fail } from '../lib/http.js';

/**
 * Rate limiting, three scopes:
 * - `ip`: every request, keyed by client IP (generous; caps floods before authentication).
 * - `auth`: `/auth/*` (login, signup, password reset, code checks), keyed by IP (strict; brute force protection).
 * - `user`: authenticated routes, keyed by the verified user id (mounted after `requireAuth`, see `requireUser`).
 *
 * Node uses in-memory fixed-window counters per process. Workers use the Cloudflare Rate Limiting binding when it exists (per-isolate
 * memory is not shared between isolates, so it is not a real limit there). Limits per minute come from env with the defaults below.
 */
export type Scope = 'auth' | 'ip' | 'user';

const WINDOW_MS = 60_000;
const RETRY_AFTER_FALLBACK = '60';

const SCOPES = {
	auth: { binding: 'RATE_LIMIT_AUTH', limit: 'RATE_LIMIT_AUTH_PER_MINUTE', perMinute: 10 },
	ip: { binding: 'RATE_LIMIT_IP', limit: 'RATE_LIMIT_IP_PER_MINUTE', perMinute: 300 },
	user: { binding: 'RATE_LIMIT_USER', limit: 'RATE_LIMIT_USER_PER_MINUTE', perMinute: 120 },
} as const satisfies Record<Scope, { binding: keyof Bindings; limit: keyof Bindings; perMinute: number }>;

/**
 * The client address. Only sources that cannot be forged by the client are used: Cloudflare's header on Workers, the socket address on
 * Node, and the first X-Forwarded-For hop only when `TRUST_PROXY=true` (a proxy you control sets it).
 */
export const clientIp = (c: Context): string => {
	if (getRuntimeKey() === 'workerd') {
		const cloudflare = c.req.header('cf-connecting-ip');
		if (cloudflare) return cloudflare;
	}
	if (env<Bindings>(c).TRUST_PROXY === 'true') {
		const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
		if (forwarded) return forwarded;
	}
	return (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress ?? 'unknown';
};

const perMinute = (value: string | undefined, fallback: number): number => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const rateLimit = (scope: Scope) => {
	const config = SCOPES[scope];
	const bindingOf = (c: Context): RateLimitBinding | undefined => (c.env as Partial<Record<string, RateLimitBinding>> | undefined)?.[config.binding];

	const common = {
		handler: (c: Context<AppEnv>) => {
			if (!c.res.headers.has('Retry-After')) c.header('Retry-After', RETRY_AFTER_FALLBACK);
			return fail(c, 'rate_limited', 429);
		},
		keyGenerator: (c: Context<AppEnv>) => `${scope}:${scope === 'user' ? (c.get('claims')?.sub ?? clientIp(c)) : clientIp(c)}`,
		skip: (c: Context<AppEnv>) => env<Bindings>(c).RATE_LIMIT_DISABLED === 'true',
	};

	const memory = rateLimiter<AppEnv>({ ...common, limit: c => perMinute(env<Bindings>(c)[config.limit] as string | undefined, config.perMinute), standardHeaders: 'draft-6', windowMs: WINDOW_MS });
	const cloudflare = rateLimiter<AppEnv>({ ...common, binding: c => bindingOf(c) as RateLimitBinding });

	return createMiddleware<AppEnv>((c, next) => (bindingOf(c) ? cloudflare(c, next) : memory(c, next)));
};
