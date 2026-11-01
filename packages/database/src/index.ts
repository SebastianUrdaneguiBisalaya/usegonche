import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/node/client.js';

export * from './generated/node/client.js';

const clients = new Map<string, PrismaClient>();

/**
 * Node / Docker entry. Long-lived process: one client (and one pg pool) per connection string.
 * Use the Supabase pooled connection string (Supavisor, port 6543) for `connectionString`.
 */
export function getPrisma(connectionString: string): PrismaClient {
	let client = clients.get(connectionString);
	if (!client) {
		client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
		clients.set(connectionString, client);
	}
	return client;
}
