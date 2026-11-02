import type { PrismaClient } from '@usegonche/database';
import type { Storage } from '@usegonche/storage';

/** Cloudflare Rate Limiting binding (see `ratelimits` in wrangler.jsonc). */
export type RateLimitBinding = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

export type Bindings = {
	/** Where the browser lands after Google sign-in / email confirmation; its origin is also allowed by CORS. */
	AUTH_REDIRECT_URL?: string;
	/** Extra browser origins allowed by CORS, comma separated (e.g. a staging web app). */
	CORS_ORIGINS?: string;
	DATABASE_URL: string;
	/** Cloudflare Hyperdrive binding (optional). Takes precedence over DATABASE_URL on Workers. */
	HYPERDRIVE?: { connectionString: string };
	/** Storage bucket names (defaults: `private` / `public`). Attachments use the private one. */
	STORAGE_BUCKET_PRIVATE?: string;
	STORAGE_BUCKET_PUBLIC?: string;
	/** `true` turns rate limiting off (tests only). */
	RATE_LIMIT_DISABLED?: string;
	/** Workers: Rate Limiting bindings. When present they replace the in-memory counters. */
	RATE_LIMIT_AUTH?: RateLimitBinding;
	RATE_LIMIT_IP?: RateLimitBinding;
	RATE_LIMIT_USER?: RateLimitBinding;
	/** Node: requests per minute (defaults: auth 10, ip 300, user 120). */
	RATE_LIMIT_AUTH_PER_MINUTE?: string;
	RATE_LIMIT_IP_PER_MINUTE?: string;
	RATE_LIMIT_USER_PER_MINUTE?: string;
	/** Shared secret of the internal endpoints called by Supabase `pg_cron` (`x-internal-secret` header). Unset = they refuse everything. */
	INTERNAL_CRON_SECRET?: string;
	SUPABASE_PUBLISHABLE_KEY: string;
	SUPABASE_URL: string;
	/** `true` when a reverse proxy you control sets X-Forwarded-For (Node). Never enable it when clients can reach the API directly. */
	TRUST_PROXY?: string;
};

export type Variables = { prisma: PrismaClient; storage: Storage };

export type AppEnv = { Bindings: Bindings; Variables: Variables };
