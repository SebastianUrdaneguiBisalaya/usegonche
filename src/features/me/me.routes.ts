import { getSupabase } from '@usegonche/auth/hono';
import { Hono } from 'hono';
import type { AppEnv } from '../../env.js';
import { isProviderAvatar } from '../../lib/avatar.js';
import { ok } from '../../lib/http.js';
import { requireUser } from '../../middleware/auth.js';
import { getProfile } from './me.service.js';

export default new Hono<AppEnv>().get('/', requireUser(), async c => {
	const claims = c.get('claims');
	const profile = await getProfile(c.get('prisma'), claims.sub);
	const { data } = await getSupabase(c).auth.getUser();
	// `avatarEditable: false` for Google accounts: the client hides the avatar editor (the API rejects the change anyway).
	return ok(c, { avatarEditable: !isProviderAvatar(data.user), email: data.user?.email ?? claims.email, id: claims.sub, profile });
});
