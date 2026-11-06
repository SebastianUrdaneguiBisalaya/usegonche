import { createClient } from '@usegonche/api-client';
import { API_BASE } from './api-config';
import { getAccessToken, refreshSession } from './auth/session';

const withBearer = (init: RequestInit | undefined, token: string | null): RequestInit => {
	const headers = new Headers(init?.headers);
	if (token) headers.set('Authorization', `Bearer ${token}`);
	return { ...init, credentials: 'omit', headers };
};

/**
 * `fetch` for authenticated requests: sends the access token (refreshed first when it is about to expire) and, on a 401, refreshes once
 * and retries once. A second 401, or a failed refresh, ends the session (`refreshSession` clears it, and the app goes back to sign-in).
 */
const authFetch: typeof fetch = async (input, init) => {
	const token = await getAccessToken();
	const res = await fetch(input, withBearer(init, token));
	if (res.status !== 401 || !token) return res;

	const fresh = await refreshSession().catch(() => null);
	if (!fresh) return res;
	return fetch(input, withBearer(init, fresh));
};

/** Typed Hono RPC client for every authenticated endpoint. Use `publicApi` (`api-config.ts`) for the sign-in endpoints. */
export const api = createClient(API_BASE, { fetch: authFetch });
