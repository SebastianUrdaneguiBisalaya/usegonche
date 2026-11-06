import { useSyncExternalStore } from 'react';
import { getSessionState, type SessionState, subscribeSession } from '@/lib/auth/session';

/** The session state (`loading` / `signedIn` / `signedOut`), re-rendering on every change (sign-in, refresh, sign-out, expired session). */
export function useSession(): SessionState {
	return useSyncExternalStore(subscribeSession, getSessionState);
}
