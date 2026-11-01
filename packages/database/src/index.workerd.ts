import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/workerd/client.js';

export * from './generated/workerd/client.js';

/**
 * Cloudflare Workers entry (selected through the "workerd" export condition).
 * Workers cannot share I/O objects (sockets) across requests, so create one client per request
 * and close it with `ctx.waitUntil(prisma.$disconnect())`. Pass the Hyperdrive connection string.
 */
export function getPrisma(connectionString: string): PrismaClient {
	return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
