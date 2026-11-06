import { publicApi } from '@/lib/api-config';
import { ApiError, type Data, unwrap } from '@/lib/api-error';
import { deleteRefreshToken, readRefreshToken, writeRefreshToken } from './token-store';

/** What every `/auth/native/*` sign-in answers: `{ accessToken, refreshToken, expiresAt, user }`. */
export type NativeSession = Data<Awaited<ReturnType<typeof publicApi.auth.native.refresh.$post>>>;
export type SessionUser = NativeSession['user'];

/**
 * - `loading`: the stored refresh token has not been read yet (the root layout keeps the splash).
 * - `signedIn`: a refresh token exists. The access token may be missing (cold start offline); the next request refreshes it.
 * - `signedOut`: no refresh token, or the API rejected it.
 */
export type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: SessionUser | null };

/** Refresh this long before the access token expires, so a request never leaves with a token that dies on the way. */
const EXPIRY_MARGIN_SECONDS = 60;

// The access token lives only in memory while the app runs.
let access: { expiresAt: number; token: string } | null = null;
let state: SessionState = { status: 'loading' };
let inFlightRefresh: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

function setState(next: SessionState) {
	state = next;
	for (const listener of listeners) listener();
}

export const getSessionState = (): SessionState => state;

export function subscribeSession(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Keeps a session answered by the API: access token in memory, refresh token in the secure store. */
export async function startSession(session: NativeSession): Promise<void> {
	await writeRefreshToken(session.refreshToken);
	access = { expiresAt: session.expiresAt, token: session.accessToken };
	setState({ status: 'signedIn', user: session.user });
}

/** Forgets the session on this device (memory + secure store). Revoking it on the server is `signOut` (see `use-sign-out.ts`). */
export async function clearSession(): Promise<void> {
	access = null;
	await deleteRefreshToken().catch(() => undefined);
	setState({ status: 'signedOut' });
}

/**
 * Trades the stored refresh token for a new pair. Single flight: concurrent callers share the same request, because the API rotates
 * refresh tokens and a second use of the old one would be detected as reuse and revoke the session.
 * Resolves the new access token, or `null` when the session is over (the API answered 401). Network errors reject and keep the session.
 */
export function refreshSession(): Promise<string | null> {
	inFlightRefresh ??= (async () => {
		try {
			const refreshToken = await readRefreshToken();
			if (!refreshToken) {
				await clearSession();
				return null;
			}
			const session = await unwrap(publicApi.auth.native.refresh.$post({ json: { refreshToken } }));
			await startSession(session);
			return session.accessToken;
		} catch (error) {
			if (error instanceof ApiError && (error.status === 401 || error.status === 422)) {
				await clearSession();
				return null;
			}
			throw error;
		} finally {
			inFlightRefresh = null;
		}
	})();
	return inFlightRefresh;
}

/** A valid access token for a request: the one in memory, or a fresh one when it is missing or about to expire. */
export function getAccessToken(): Promise<string | null> {
	if (state.status !== 'signedIn') return Promise.resolve(null);
	if (access && access.expiresAt - Date.now() / 1000 > EXPIRY_MARGIN_SECONDS) return Promise.resolve(access.token);
	return refreshSession();
}

/** Cold start: a stored refresh token means signed in. It is refreshed right away; offline, the session stays and the next request retries. */
export async function restoreSession(): Promise<void> {
	const refreshToken = await readRefreshToken().catch(() => null);
	if (!refreshToken) {
		setState({ status: 'signedOut' });
		return;
	}
	setState({ status: 'signedIn', user: null });
	await refreshSession().catch(() => undefined);
}
