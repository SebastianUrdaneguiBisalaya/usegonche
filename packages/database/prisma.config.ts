import { defineConfig } from 'prisma/config';

// The Prisma CLI does not load .env by itself. Use the shared root .env when present.
try {
	process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
	// Variables may already be set in the environment (CI, Docker, etc.).
}

export default defineConfig({
	datasource: {
		// Migrations need a direct (non-pooled) connection: Supabase direct or session pooler (port 5432).
		// Empty on purpose so `prisma generate` works without a database; migrate commands fail clearly if unset.
		url: process.env.DIRECT_URL ?? '',
	},
	migrations: { path: 'prisma/migrations' },
	schema: 'prisma/schema.prisma',
});
