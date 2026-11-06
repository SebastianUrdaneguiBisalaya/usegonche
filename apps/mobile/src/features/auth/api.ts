import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { type Body, publicApi } from '@/lib/api-config';
import { unwrap } from '@/lib/api-error';
import { clearSession, getAccessToken, startSession } from '@/lib/auth/session';
import { queryClient } from '@/providers/query-client';

/** Request bodies come from the API through the RPC client: nothing is redeclared here. */
type Native = typeof publicApi.auth.native;
export type LoginInput = Body<Native['login']['$post']>;
export type SignupInput = Body<Native['signup']['$post']>;
export type VerifyEmailInput = Body<Native['verify-email']['$post']>;
export type ForgotPasswordInput = Body<Native['forgot-password']['$post']>;
export type ResetPasswordInput = Body<Native['reset-password']['$post']>;

/** Sign-ins answer the session; keeping it switches the protected routes on. */
export function useLogin() {
	return useMutation({
		mutationFn: async (json: LoginInput) => startSession(await unwrap(publicApi.auth.native.login.$post({ json }))),
	});
}

/** Creates the account; Supabase emails a code that `useVerifyEmail` checks. */
export function useSignup() {
	return useMutation({ mutationFn: (json: SignupInput) => unwrap(publicApi.auth.native.signup.$post({ json })) });
}

export function useVerifyEmail() {
	return useMutation({
		mutationFn: async (json: VerifyEmailInput) => startSession(await unwrap(publicApi.auth.native['verify-email'].$post({ json }))),
	});
}

export function useForgotPassword() {
	return useMutation({ mutationFn: (json: ForgotPasswordInput) => unwrap(publicApi.auth.native['forgot-password'].$post({ json })) });
}

/** Sets the new password and signs this device in (every other session is signed out by the API). */
export function useResetPassword() {
	return useMutation({
		mutationFn: async (json: ResetPasswordInput) => startSession(await unwrap(publicApi.auth.native['reset-password'].$post({ json }))),
	});
}

/**
 * Revokes the session on the server (best effort: offline it still signs out locally), then wipes the secure store and the query cache,
 * so nothing of this account stays on the device.
 */
export function useSignOut() {
	return useMutation({
		mutationFn: async () => {
			const token = await getAccessToken().catch(() => null);
			if (token) await api.auth.native.logout.$post({ header: { authorization: `Bearer ${token}` } }).catch(() => undefined);
			await clearSession();
			queryClient.clear();
		},
	});
}
