import type { Claims, SupabaseClient } from '@usegonche/auth/hono';
import type { PrismaClient } from '@usegonche/database';
import type { Storage } from '@usegonche/storage';
import { Hono } from 'hono';
import { vi } from 'vitest';
import type { AppEnv } from '../env.js';
import { onError, onNotFound } from '../middleware/error.js';

/** A valid UUID v4 to use as the authenticated user in tests. */
export const TEST_USER_ID = '3f2b8c1e-9d4a-4e6b-8a57-1c0d2e3f4a5b';
/** A second user, to assert that data never leaks across owners. */
export const OTHER_USER_ID = '8a1d5e7c-2b39-4f40-9c6e-7d8b0a1c2e3f';

/**
 * Prisma double: any `prisma.<model>.<operation>` is a lazily created `vi.fn()`.
 * Configure with `vi.mocked(prisma.tag.findMany).mockResolvedValue([...])`.
 */
export const createMockPrisma = (): PrismaClient => {
	const models = new Map<string, Map<string, ReturnType<typeof vi.fn>>>();
	const operations = (model: string) =>
		new Proxy(
			{},
			{
				get: (_target, operation) => {
					if (typeof operation !== 'string') return undefined;
					let fns = models.get(model);
					if (!fns) models.set(model, (fns = new Map()));
					let fn = fns.get(operation);
					if (!fn) fns.set(operation, (fn = vi.fn()));
					return fn;
				},
			}
		);
	const cache = new Map<string, unknown>();
	const prisma: PrismaClient = new Proxy(
		{},
		{
			get: (_target, model) => {
				if (typeof model !== 'string' || model === 'then') return undefined;
				if (model === '$transaction') return vi.fn(async (arg: unknown) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[])));
				let proxy = cache.get(model);
				if (!proxy) cache.set(model, (proxy = operations(model)));
				return proxy;
			},
		}
	) as PrismaClient;
	return prisma;
};

type TestAppOptions = {
	/** Verified JWT claims. `null` simulates an unauthenticated request (requireAuth answers 401). Defaults to `TEST_USER_ID`. */
	claims?: Claims | null;
	/** `false` simulates a user who has not confirmed their email (requireAuth answers 403). Defaults to `true`. */
	emailConfirmed?: boolean;
	/** Mount point of the router under test. Defaults to `/`. */
	path?: string;
	prisma?: PrismaClient;
	/** Sign-in methods linked to the user (`user.identities[].provider`). Defaults to `['email']`. */
	providers?: string[];
	storage?: Storage;
};

/** Storage double: every operation is a `vi.fn()` (configure with `vi.mocked(storage.readUrl).mockResolvedValue(...)`). */
export const createMockStorage = (): Storage => ({ list: vi.fn(), readUrl: vi.fn(), remove: vi.fn(), uploadUrl: vi.fn() }) as unknown as Storage;

/**
 * Mounts a feature router in an app that mirrors production wiring (prisma + supabase variables, `onError`, `onNotFound`)
 * but with a fake Supabase client, so the real `requireAuth()` runs without mocking modules.
 *
 * @example
 * const prisma = createMockPrisma();
 * const app = createTestApp(tags, { path: '/tags', prisma });
 * const res = await app.request('/tags');
 */
export const createTestApp = (
	router: Hono<AppEnv>,
	{ claims = { sub: TEST_USER_ID }, emailConfirmed = true, path = '/', prisma = createMockPrisma(), providers = ['email'], storage = createMockStorage() }: TestAppOptions = {}
) => {
	const supabase = {
		auth: {
			getClaims: async () => (claims ? { data: { claims }, error: null } : { data: null, error: new Error('unauthenticated') }),
			getUser: async () =>
				claims
					? { data: { user: { email_confirmed_at: emailConfirmed ? '2026-01-01T00:00:00Z' : null, id: claims.sub, identities: providers.map(provider => ({ provider })) } }, error: null }
					: { data: { user: null }, error: new Error('unauthenticated') },
		},
	} as unknown as SupabaseClient;

	return new Hono<AppEnv>()
		.use(async (c, next) => {
			c.set('prisma', prisma);
			c.set('storage', storage);
			c.set('supabase', supabase);
			await next();
		})
		.route(path, router)
		.onError(onError)
		.notFound(onNotFound);
};

/** JSON request init for `app.request()` (sets the `Content-Type` that `zValidator('json')` requires). */
export const jsonRequest = (method: 'PATCH' | 'POST' | 'PUT', body: unknown): RequestInit => ({
	body: JSON.stringify(body),
	headers: { 'Content-Type': 'application/json' },
	method,
});
