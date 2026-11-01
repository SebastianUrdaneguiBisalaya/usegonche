import { getSupabase, requireAuth, supabaseMiddleware } from '@usegonche/auth/hono';
import { getPrisma, type PrismaClient } from '@usegonche/database';
import { Hono } from 'hono';
import { env, getRuntimeKey } from 'hono/adapter';

type Bindings = {
	DATABASE_URL: string;
	/** Cloudflare Hyperdrive binding (optional). Takes precedence over DATABASE_URL on Workers. */
	HYPERDRIVE?: { connectionString: string };
	SUPABASE_PUBLISHABLE_KEY: string;
	SUPABASE_URL: string;
};

type Variables = { prisma: PrismaClient };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use(supabaseMiddleware());

app.use(async (c, next) => {
	const bindings = env<Bindings>(c);
	const connectionString = bindings.HYPERDRIVE?.connectionString ?? bindings.DATABASE_URL;
	if (!connectionString) throw new Error('DATABASE_URL missing!');

	const prisma = getPrisma(connectionString);
	c.set('prisma', prisma);
	await next();

	// Workers: sockets cannot outlive the request, so close the per-request client after responding.
	if (getRuntimeKey() === 'workerd') c.executionCtx.waitUntil(prisma.$disconnect());
});

app.get('/', c => c.text('Hello Hono!'));

app.get('/health', async c => {
	await c.get('prisma').$queryRaw`SELECT 1`;
	return c.json({ ok: true });
});

app.get('/me', requireAuth(), async c => {
	const claims = c.get('claims');
	const profile = await c.get('prisma').profile.findUnique({ where: { id: claims.sub } });
	const { data } = await getSupabase(c).auth.getUser();
	return c.json({ email: data.user?.email ?? claims.email, id: claims.sub, profile });
});

export default app;
