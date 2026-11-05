import { createClient } from '@usegonche/api-client';
import { data, redirect } from 'react-router';
import type { Session } from '~/features/auth/api';
import type { UserSettings } from '~/features/protected/settings/api';
import { API_BASE } from '~/lib/api';

export interface SignedIn {
	/** Response headers to send back: the API may have refreshed the session, and its new cookies must reach the browser. */
	headers: Headers;
	session: Session;
	settings: UserSettings;
}

/**
 * Resolves who is signed in on the server, before anything paints: the request cookie is forwarded to `GET /me` and `GET /profile/settings`
 * (in parallel). No cookie or a 401/403 redirects to sign-in, so a signed-out visitor never sees a signed-in screen. The browser always sends
 * the session cookie to the web server (same host in dev, the shared `COOKIE_DOMAIN` in production), so a missing cookie means signed out.
 * Any other failure (API down) is thrown and the error boundary shows it.
 * Every protected loader calls it on its own: a parent loader does not protect its children. The API stays the authority either way.
 */
export async function requireSignedIn(request: Request): Promise<SignedIn> {
	const cookie = request.headers.get('cookie');
	if (!cookie) throw redirect('/auth/sign-in');
	const client = createClient(API_BASE, { headers: { cookie } });
	const [me, settings] = await Promise.all([client.me.$get(), client.profile.settings.$get()]);
	// The API's 401/403 come from its global middleware, so they are not part of the inferred response types.
	const statuses: number[] = [me.status, settings.status];
	if (statuses.some(status => status === 401 || status === 403)) throw redirect('/auth/sign-in');
	if (!me.ok || !settings.ok) throw data('Service unavailable', { status: 503 });

	const headers = new Headers();
	for (const res of [me, settings]) for (const value of res.headers.getSetCookie()) headers.append('Set-Cookie', value);
	return { headers, session: (await me.json()).data, settings: (await settings.json()).data };
}
