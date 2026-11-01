import { createStorage } from '@usegonche/storage';
import { env } from 'hono/adapter';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Bindings } from '../env.js';

/** Request-scoped storage helper (signed URLs only), exposed as `c.get('storage')`. Must run after `supabaseMiddleware`. */
export const storageMiddleware = () =>
	createMiddleware<AppEnv>(async (c, next) => {
		const { STORAGE_BUCKET_PRIVATE, STORAGE_BUCKET_PUBLIC } = env<Bindings>(c);
		c.set('storage', createStorage(c.get('supabase'), { private: STORAGE_BUCKET_PRIVATE || 'private', public: STORAGE_BUCKET_PUBLIC || 'public' }));
		await next();
	});
