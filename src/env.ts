import type { PrismaClient } from '@usegonche/database';
import type { Storage } from '@usegonche/storage';

export type Bindings = {
	DATABASE_URL: string;
	/** Cloudflare Hyperdrive binding (optional). Takes precedence over DATABASE_URL on Workers. */
	HYPERDRIVE?: { connectionString: string };
	/** Storage bucket names (defaults: `private` / `public`). Attachments use the private one. */
	STORAGE_BUCKET_PRIVATE?: string;
	STORAGE_BUCKET_PUBLIC?: string;
	SUPABASE_PUBLISHABLE_KEY: string;
	SUPABASE_URL: string;
};

export type Variables = { prisma: PrismaClient; storage: Storage };

export type AppEnv = { Bindings: Bindings; Variables: Variables };
