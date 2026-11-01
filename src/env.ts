import type { PrismaClient } from '@usegonche/database';

export type Bindings = {
	DATABASE_URL: string;
	/** Cloudflare Hyperdrive binding (optional). Takes precedence over DATABASE_URL on Workers. */
	HYPERDRIVE?: { connectionString: string };
	SUPABASE_PUBLISHABLE_KEY: string;
	SUPABASE_URL: string;
};

export type Variables = { prisma: PrismaClient };

export type AppEnv = { Bindings: Bindings; Variables: Variables };
