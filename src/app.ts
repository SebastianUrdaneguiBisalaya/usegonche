import { supabaseMiddleware } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import health from './features/health/health.routes.js';
import internalReminders from './features/reminders/reminders.internal.routes.js';
import { corsMiddleware } from './middleware/cors.js';
import { onError, onNotFound } from './middleware/error.js';
import { prismaMiddleware } from './middleware/prisma.js';
import { rateLimit } from './middleware/rate-limit.js';
import { storageMiddleware } from './middleware/storage.js';
import routes from './routes.js';

const app = new Hono<AppEnv>()
	.use(corsMiddleware())
	.use(rateLimit('ip'))
	.use('/v1/auth/*', rateLimit('auth'))
	.use(supabaseMiddleware())
	.use(prismaMiddleware())
	.use(storageMiddleware())
	.get('/', c => c.text('Hello Hono!'))
	// Unversioned on purpose: Docker healthcheck and uptime monitors must keep working across API versions.
	.route('/health', health)
	.route('/v1/internal/reminders', internalReminders)
	.route('/v1', routes)
	.onError(onError)
	.notFound(onNotFound);

export default app;
