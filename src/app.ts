import { supabaseMiddleware } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import { onError, onNotFound } from './middleware/error.js';
import { prismaMiddleware } from './middleware/prisma.js';
import { rateLimit } from './middleware/rate-limit.js';
import { storageMiddleware } from './middleware/storage.js';
import routes from './routes.js';

const app = new Hono<AppEnv>()
	.use(rateLimit('ip'))
	.use('/auth/*', rateLimit('auth'))
	.use(supabaseMiddleware())
	.use(prismaMiddleware())
	.use(storageMiddleware())
	.get('/', c => c.text('Hello Hono!'))
	.route('/', routes)
	.onError(onError)
	.notFound(onNotFound);

export default app;
