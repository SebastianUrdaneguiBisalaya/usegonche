import { createClient } from '@usegonche/api-client';
import { createContext, data, type RouterContextProvider, redirect } from 'react-router';
import type { Session } from '~/features/auth/api';
import type { UserSettings } from '~/features/protected/settings/api';
import { API_BASE } from '~/lib/api';

/** What an API call answered, read once: a response body cannot be shared, the parsed result can. */
interface Answer<T> {
	data?: T;
	/** Cookies the API set (a refreshed session); they must reach the browser. */
	setCookie: string[];
	status: number;
}

type Context = Readonly<RouterContextProvider>;

const settingsContext = createContext<Promise<Answer<UserSettings>> | null>(null);

async function read<T>(request: Promise<{ headers: Headers; json(): Promise<unknown>; ok: boolean; status: number }>): Promise<Answer<T>> {
	const res = await request;
	const body = res.ok ? ((await res.json()) as { data: T }) : undefined;
	return { data: body?.data, setCookie: res.headers.getSetCookie(), status: res.status };
}

/**
 * `GET /profile/settings` with the request's cookie, asked once per request: the root loader (theme and language of the first paint) and the
 * signed-in loaders (onboarding) run in parallel and share the same answer through the router context.
 */
export function accountSettings(request: Request, context: Context): Promise<Answer<UserSettings>> | null {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	let answer = context.get(settingsContext);
	if (!answer) {
		answer = read<UserSettings>(createClient(API_BASE, { headers: { cookie } }).profile.settings.$get());
		context.set(settingsContext, answer);
	}
	return answer;
}

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
export async function requireSignedIn(request: Request, context: Context): Promise<SignedIn> {
	const cookie = request.headers.get('cookie');
	const settingsAnswer = accountSettings(request, context);
	if (!cookie || !settingsAnswer) throw redirect('/auth/sign-in');
	const [me, settings] = await Promise.all([read<Session>(createClient(API_BASE, { headers: { cookie } }).me.$get()), settingsAnswer]);
	// The API's 401/403 come from its global middleware, so they are not part of the inferred response types.
	if ([me.status, settings.status].some(status => status === 401 || status === 403)) throw redirect('/auth/sign-in');
	if (!me.data || !settings.data) throw data('Service unavailable', { status: 503 });

	const headers = new Headers();
	for (const value of [...me.setCookie, ...settings.setCookie]) headers.append('Set-Cookie', value);
	return { headers, session: me.data, settings: settings.data };
}
