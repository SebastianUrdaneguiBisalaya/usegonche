import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { requireUser } from '../../middleware/auth.js';
import { updateProfileSchema, updateSettingsSchema } from './profile.schemas.js';
import { getProfile, getSettings, type Identity, updateProfile, updateSettings } from './profile.service.js';

// The user always comes from the verified claims, never from the body.
const identity = (c: Context<AppEnv>): Identity => {
	const claims = c.get('claims');
	return { email: claims.email, id: claims.sub };
};

export default new Hono<AppEnv>()
	.use(requireUser())
	.get('/', async c => ok(c, await getProfile(c.get('prisma'), identity(c)), 200))
	.patch('/', zValidator('json', updateProfileSchema, validationHook), async c => ok(c, await updateProfile(c.get('prisma'), identity(c), c.req.valid('json')), 200))
	.get('/settings', async c => ok(c, await getSettings(c.get('prisma'), identity(c)), 200))
	.patch('/settings', zValidator('json', updateSettingsSchema, validationHook), async c => ok(c, await updateSettings(c.get('prisma'), identity(c), c.req.valid('json')), 200));
