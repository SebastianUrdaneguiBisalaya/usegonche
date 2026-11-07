import { zValidator } from '@hono/zod-validator';
import { createSupabaseAdmin } from '@usegonche/auth/admin';
import { getSupabase } from '@usegonche/auth/hono';
import { createStorage } from '@usegonche/storage';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { env } from 'hono/adapter';
import type { AppEnv, Bindings } from '../../env.js';
import { hasProviderAvatar } from '../../lib/avatar.js';
import { fail, ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { storageBuckets } from '../../middleware/storage.js';
import { avatarUploadSchema, updateProfileSchema, updateSettingsSchema } from './profile.schemas.js';
import { createAvatarUploadUrl, deleteAccount, getGettingStarted, getProfile, getSettings, type Identity, updateProfile, updateSettings } from './profile.service.js';

// The user always comes from the verified claims, never from the body.
const identity = (c: Context<AppEnv>): Identity => {
	const claims = c.get('claims');
	return { email: claims.email, id: claims.sub };
};

export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', async c => ok(c, await getProfile(c.get('prisma'), identity(c)), 200))
	// A Google account shows its Google picture: the avatar cannot be changed or removed (`lib/avatar.ts`).
	.patch('/', zValidator('json', updateProfileSchema, validationHook), async c => {
		const input = c.req.valid('json');
		if (input.avatarUrl !== undefined && (await hasProviderAvatar(c))) return fail(c, 'forbidden', 403);
		return ok(c, await updateProfile(c.get('prisma'), identity(c), input), 200);
	})
	// Deletes the account for good: files, every row of the user and the Supabase Auth user. Needs the admin (secret) key.
	.delete('/', async c => {
		const bindings = env<Bindings>(c);
		if (!bindings.SUPABASE_SECRET_KEY) return fail(c, 'service_unavailable', 503);
		const admin = createSupabaseAdmin(bindings.SUPABASE_URL, bindings.SUPABASE_SECRET_KEY);
		await deleteAccount(c.get('prisma'), c.get('claims').sub, {
			deleteAuthUser: async id => {
				const { error } = await admin.auth.admin.deleteUser(id);
				if (error) throw error;
			},
			storage: createStorage(admin, storageBuckets(bindings)),
		});
		// Clears the session cookies; the user no longer exists, so a failure here changes nothing.
		await Promise.resolve()
			.then(() => getSupabase(c).auth.signOut({ scope: 'local' }))
			.catch(() => undefined);
		return ok(c, { deleted: true as const }, 200);
	})
	.post('/avatar/upload-url', zValidator('json', avatarUploadSchema, validationHook), async c => {
		if (await hasProviderAvatar(c)) return fail(c, 'forbidden', 403);
		return ok(c, await createAvatarUploadUrl(c.get('storage'), c.get('claims').sub, c.req.valid('json')), 200);
	})
	.get('/getting-started', async c => ok(c, await getGettingStarted(c.get('prisma'), c.get('claims').sub), 200))
	.get('/settings', async c => ok(c, await getSettings(c.get('prisma'), identity(c)), 200))
	.patch('/settings', zValidator('json', updateSettingsSchema, validationHook), async c => ok(c, await updateSettings(c.get('prisma'), identity(c), c.req.valid('json')), 200));
