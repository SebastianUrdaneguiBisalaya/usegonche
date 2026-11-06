import { useMutation } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { publicApi } from '@/lib/api-config';
import { ApiError, unwrap } from '@/lib/api-error';
import { createPkcePair } from '@/lib/auth/pkce';
import { startSession } from '@/lib/auth/session';

/** Where Supabase sends the browser back. Must match the API's `NATIVE_AUTH_REDIRECT_URL` and Supabase → Redirect URLs. */
export const GOOGLE_REDIRECT_URL = 'usegonche://auth/callback';

/**
 * Google sign-in with Supabase PKCE, all through the API:
 * 1. the device creates the verifier and its challenge;
 * 2. the API answers the Supabase authorize URL for that challenge (the redirect is fixed server side);
 * 3. the system browser (`openAuthSessionAsync`) signs in with Google and comes back to the app scheme with `?code=`;
 * 4. the API trades `code` + verifier for the session.
 * Resolves `false` when the user closes the browser (not an error).
 */
async function signInWithGoogle(): Promise<boolean> {
	const { challenge, verifier } = await createPkcePair();
	const { url } = await unwrap(publicApi.auth.native.google.$get({ query: { code_challenge: challenge } }));

	const result = await WebBrowser.openAuthSessionAsync(url, GOOGLE_REDIRECT_URL);
	if (result.type !== 'success') return false;

	const params = new URL(result.url).searchParams;
	const code = params.get('code');
	// Supabase reports failures (e.g. the database blocking a second sign-in method) as query params.
	if (!code) throw new ApiError(400, params.get('error_code') === 'provider_conflict' ? 'provider_conflict' : 'auth_failed', '');

	await startSession(await unwrap(publicApi.auth.native.google.$post({ json: { code, code_verifier: verifier } })));
	return true;
}

export function useGoogleSignIn() {
	return useMutation({ mutationFn: signInWithGoogle });
}
