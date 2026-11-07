import { createStorage, type StorageBuckets } from '@usegonche/storage';
import { env } from 'hono/adapter';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Bindings } from '../env.js';

/** Bucket names from the env (defaults: `private` / `public`). */
export const storageBuckets = ({ STORAGE_BUCKET_PRIVATE, STORAGE_BUCKET_PUBLIC }: Bindings): StorageBuckets => ({
	private: STORAGE_BUCKET_PRIVATE || 'private',
	public: STORAGE_BUCKET_PUBLIC || 'public',
});

/** Request-scoped storage helper (signed URLs only), exposed as `c.get('storage')`. Must run after `supabaseMiddleware`. */
export const storageMiddleware = () =>
	createMiddleware<AppEnv>(async (c, next) => {
		c.set('storage', createStorage(c.get('supabase'), storageBuckets(env<Bindings>(c))));
		await next();
	});
