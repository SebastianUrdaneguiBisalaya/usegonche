import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { hasProviderAvatar } from '../../lib/avatar.js';
import { fail, ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { avatarUploadSchema, updateProfileSchema, updateSettingsSchema } from './profile.schemas.js';
import { createAvatarUploadUrl, getGettingStarted, getProfile, getSettings, type Identity, updateProfile, updateSettings } from './profile.service.js';

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
	.post('/avatar/upload-url', zValidator('json', avatarUploadSchema, validationHook), async c => {
		if (await hasProviderAvatar(c)) return fail(c, 'forbidden', 403);
		return ok(c, await createAvatarUploadUrl(c.get('storage'), c.get('claims').sub, c.req.valid('json')), 200);
	})
	.get('/getting-started', async c => ok(c, await getGettingStarted(c.get('prisma'), c.get('claims').sub), 200))
	.get('/settings', async c => ok(c, await getSettings(c.get('prisma'), identity(c)), 200))
	.patch('/settings', zValidator('json', updateSettingsSchema, validationHook), async c => ok(c, await updateSettings(c.get('prisma'), identity(c), c.req.valid('json')), 200));
