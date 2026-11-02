import { env } from 'hono/adapter';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Bindings } from '../env.js';

type CorsBindings = Pick<Bindings, 'AUTH_REDIRECT_URL' | 'CORS_ORIGINS'>;

const originOf = (url: string): string | undefined => {
	try {
		return new URL(url).origin;
	} catch {
		return undefined;
	}
};

/** Origins allowed to call the API from a browser: the web app (origin of `AUTH_REDIRECT_URL`) plus the optional comma-separated `CORS_ORIGINS`. */
export const allowedOrigins = ({ AUTH_REDIRECT_URL, CORS_ORIGINS }: CorsBindings): string[] =>
	[AUTH_REDIRECT_URL, ...(CORS_ORIGINS?.split(',') ?? [])].map(value => originOf(value?.trim() ?? '')).filter((origin): origin is string => origin !== undefined);

/**
 * CORS for browser clients. The session lives in cookies, so credentials are allowed and the origin is never `*`: the request origin is echoed
 * only when it is in the allow list, otherwise no CORS headers are sent and the browser blocks the call. Mount it first so preflights (`OPTIONS`)
 * are answered before rate limiting and auth.
 */
export const corsMiddleware = () =>
	createMiddleware<AppEnv>((c, next) => {
		const allowed = allowedOrigins(env<CorsBindings>(c));
		return cors({
			allowHeaders: ['Content-Type', 'Authorization'],
			allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			credentials: true,
			maxAge: 600,
			origin: origin => (allowed.includes(origin) ? origin : null),
		})(c, next);
	});
