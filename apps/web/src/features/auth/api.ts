import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRevalidator } from 'react-router';
import { api, type Body } from '~/lib/api';
import { type Data, unwrap } from '~/lib/api-error';

/** Request bodies and the user come from the API through the RPC client: nothing is redeclared here. */
export type LoginInput = Body<typeof api.auth.login.$post>;
export type SignupInput = Body<typeof api.auth.signup.$post>;
export type ForgotPasswordInput = Body<(typeof api.auth)['forgot-password']['$post']>;
export type GoogleLoginInput = Body<typeof api.auth.google.$post>;
export type ResetPasswordInput = Body<(typeof api.auth)['reset-password']['$post']>;

export const sessionKey = ['session'] as const;

/** What `GET /me` answers: the signed-in user with the profile. */
export type Session = Data<Awaited<ReturnType<typeof api.me.$get>>>;

/**
 * Who is signed in, straight from `GET /me`: the tokens are httpOnly cookies the page cannot read, so the API is the only source of truth
 * (this also covers sign-ins that finish on the API, like the Google redirect or the email link). A 401 means signed out and is not toasted.
 */
export function useSession() {
	return useQuery({
		meta: { silent: true },
		queryFn: () => unwrap(api.me.$get()),
		queryKey: sessionKey,
		retry: false,
	});
}

/**
 * Refetches the session; returned from `onSuccess` so the mutation settles once the new session is known. It also reruns the loaders: the root one
 * decides theme and language from the account's saved settings, which on a sign-in (no full page load) were not known when the page was rendered.
 */
function useRefreshSession() {
	const queryClient = useQueryClient();
	const { revalidate } = useRevalidator();
	return async () => {
		await queryClient.invalidateQueries({ queryKey: sessionKey });
		await revalidate();
	};
}

export function useLogin() {
	const refreshSession = useRefreshSession();
	return useMutation({
		mutationFn: (json: LoginInput) => unwrap(api.auth.login.$post({ json })),
		onSuccess: refreshSession,
	});
}

export function useSignup() {
	return useMutation({
		mutationFn: (json: SignupInput) => unwrap(api.auth.signup.$post({ json })),
	});
}

export function useForgotPassword() {
	return useMutation({
		mutationFn: (json: ForgotPasswordInput) => unwrap(api.auth['forgot-password'].$post({ json })),
	});
}

/** The API signs the user in once the password is reset. */
export function useResetPassword() {
	const refreshSession = useRefreshSession();
	return useMutation({
		mutationFn: (json: ResetPasswordInput) => unwrap(api.auth['reset-password'].$post({ json })),
		onSuccess: refreshSession,
	});
}

export function useLogout() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => unwrap(api.auth.logout.$post()),
		onSettled: () => queryClient.removeQueries({ queryKey: sessionKey }),
	});
}

/** Exchanges a Google authorization code (web popup or desktop bridge) for a session. */
export function useLoginWithGoogle() {
	const refreshSession = useRefreshSession();
	return useMutation({
		mutationFn: (json: GoogleLoginInput) => unwrap(api.auth.google.$post({ json })),
		onSuccess: refreshSession,
	});
}
