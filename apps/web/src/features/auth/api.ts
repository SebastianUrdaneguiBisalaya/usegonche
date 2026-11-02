import { useMutation } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { type Data, unwrap } from '~/lib/api-error';
import { useSessionStore } from '~/store/session-store';

/** Request bodies and the user come from the API through the RPC client: nothing is redeclared here. */
export type LoginInput = Body<typeof api.auth.login.$post>;
export type SignupInput = Body<typeof api.auth.signup.$post>;
export type ForgotPasswordInput = Body<(typeof api.auth)['forgot-password']['$post']>;
export type GoogleLoginInput = Body<typeof api.auth.google.$post>;
export type ResetPasswordInput = Body<(typeof api.auth)['reset-password']['$post']>;
export type AuthUser = Data<Awaited<ReturnType<typeof api.auth.login.$post>>>['user'];

export function useLogin() {
	const setUser = useSessionStore(state => state.setUser);
	return useMutation({
		mutationFn: (json: LoginInput) => unwrap(api.auth.login.$post({ json })),
		onSuccess: ({ user }) => setUser(user),
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
	const setUser = useSessionStore(state => state.setUser);
	return useMutation({
		mutationFn: (json: ResetPasswordInput) => unwrap(api.auth['reset-password'].$post({ json })),
		onSuccess: ({ user }) => setUser(user),
	});
}

export function useLogout() {
	const clearUser = useSessionStore(state => state.clearUser);
	return useMutation({
		mutationFn: () => unwrap(api.auth.logout.$post()),
		onSettled: clearUser,
	});
}

/** Exchanges a Google authorization code (web popup or desktop bridge) for a session. */
export function useLoginWithGoogle() {
	const setUser = useSessionStore(state => state.setUser);
	return useMutation({
		mutationFn: (json: GoogleLoginInput) => unwrap(api.auth.google.$post({ json })),
		onSuccess: ({ user }) => setUser(user),
	});
}
