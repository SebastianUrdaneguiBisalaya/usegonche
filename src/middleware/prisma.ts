import { getPrisma } from '@usegonche/database';
import { env, getRuntimeKey } from 'hono/adapter';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Bindings } from '../env.js';

/** Per-request Prisma client, exposed as `c.get('prisma')`. */
export const prismaMiddleware = () =>
	createMiddleware<AppEnv>(async (c, next) => {
		const bindings = env<Bindings>(c);
		const connectionString = bindings.HYPERDRIVE?.connectionString ?? bindings.DATABASE_URL;
		if (!connectionString) throw new Error('DATABASE_URL missing!');

		const prisma = getPrisma(connectionString);
		c.set('prisma', prisma);
		await next();

		// Workers: sockets cannot outlive the request, so close the per-request client after responding.
		if (getRuntimeKey() === 'workerd') c.executionCtx.waitUntil(prisma.$disconnect());
	});
