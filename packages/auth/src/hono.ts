import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { Context, MiddlewareHandler } from 'hono';
import { env } from 'hono/adapter';
import { setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import type { CookieOptions } from 'hono/utils/cookie';

/** Client type as returned by @supabase/ssr (avoids duplicate supabase-js type identities). */
export type SupabaseClient = ReturnType<typeof createServerClient>;

export type SupabaseBindings = {
	SUPABASE_PUBLISHABLE_KEY: string;
	SUPABASE_URL: string;
};

export type Claims = { [key: string]: unknown; email?: string; sub: string };

declare module 'hono' {
	interface ContextVariableMap {
		claims: Claims;
		supabase: SupabaseClient;
	}
}

const bearerToken = (c: Context): string | undefined => {
	const header = c.req.header('Authorization');
	return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
};

export const getSupabase = (c: Context): SupabaseClient => c.get('supabase');

/**
 * Creates a request-scoped Supabase client.
 * Web clients authenticate with cookies (SSR); mobile / API clients can send `Authorization: Bearer <access_token>`.
 * Works on Node and Cloudflare Workers: variables are read with `hono/adapter` (process.env or bindings).
 */
export const supabaseMiddleware = (): MiddlewareHandler => async (c, next) => {
	const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env<SupabaseBindings>(c);
	if (!SUPABASE_URL) throw new Error('SUPABASE_URL missing!');
	if (!SUPABASE_PUBLISHABLE_KEY) throw new Error('SUPABASE_PUBLISHABLE_KEY missing!');

	const token = bearerToken(c);
	const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll() {
				return parseCookieHeader(c.req.header('Cookie') ?? '');
			},
			setAll(cookiesToSet, cacheHeaders) {
				for (const { name, value, options } of cookiesToSet) setCookie(c, name, value, options as CookieOptions);
				for (const [key, value] of Object.entries(cacheHeaders)) c.header(key, value);
			},
		},
		global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
	});

	c.set('supabase', supabase);
	await next();
};

/** Message of the 403 raised for an unconfirmed email; `onError` maps it to the `email_not_confirmed` error code. */
export const EMAIL_NOT_CONFIRMED = 'email_not_confirmed';

/**
 * Rejects unauthenticated requests and exposes the verified JWT claims as `c.get('claims')`.
 * Users who have not confirmed their email get a 403, even if they somehow hold a valid session.
 */
export const requireAuth = (): MiddlewareHandler => async (c, next) => {
	const supabase = getSupabase(c);
	const token = bearerToken(c);
	const { data, error } = await supabase.auth.getClaims(token);
	if (error || !data) throw new HTTPException(401);
	// The JWT does not say whether the email is confirmed; the auth server does.
	const { data: userData, error: userError } = await supabase.auth.getUser(token);
	if (userError || !userData.user) throw new HTTPException(401);
	if (!userData.user.email_confirmed_at) throw new HTTPException(403, { message: EMAIL_NOT_CONFIRMED });
	c.set('claims', data.claims as Claims);
	await next();
};
