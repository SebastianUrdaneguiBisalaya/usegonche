import { zValidator } from '@hono/zod-validator';
import { getSupabase } from '@usegonche/auth/hono';
import { providersOf, rejectMixedProviders } from '@usegonche/auth/policy';
import { type Context, Hono } from 'hono';
import { env } from 'hono/adapter';
import type { AppEnv } from '../../env.js';
import { fail, ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import { callbackQuerySchema, forgotPasswordSchema, googleLoginSchema, loginSchema, resetPasswordSchema, signupSchema } from './auth.schemas.js';
import { type AuthUser, exchangeGoogleCode, type GoogleConfig, publicUser, syncProfile } from './auth.service.js';

type AuthBindings = {
	/** Absolute URL of `GET /auth/callback` on this API. Defaults to the request origin (set it behind proxies). */
	AUTH_CALLBACK_URL?: string;
	/** Where the browser lands after Google sign-in / email confirmation. `?error=<code>` is appended on failure. */
	AUTH_REDIRECT_URL?: string;
};

type GoogleBindings = GoogleConfig;

const callbackUrl = (c: Context<AppEnv>) => env<AuthBindings>(c).AUTH_CALLBACK_URL ?? new URL('/auth/callback', c.req.url).toString();

// Never throws, so it can be used directly in handlers: errors become redirects/JSON for the browser.
const redirectToApp = (c: Context<AppEnv>, error?: string) => {
	const base = env<AuthBindings>(c).AUTH_REDIRECT_URL;
	if (!base) return error ? fail(c, 'bad_request', 400, [{ code: error, field: 'callback' }]) : ok(c, { ok: true });
	const url = new URL(base);
	if (error) url.searchParams.set('error', error);
	return c.redirect(url.toString());
};

const signedIn = (c: Context<AppEnv>, user: AuthUser) => syncProfile(c.get('prisma'), user);

/**
 * Email + password and Google authentication, plus OTP-code password recovery.
 * Rules: Google creates the account on first sign-in; an email can only ever use one sign-in method;
 * passwords are changed only through a one-time code sent to the email (forgot password).
 */
export default new Hono<AppEnv>()
	.post(
		'/signup',
		zValidator('json', signupSchema, (result, c) => {
			if (result.success) return;
			const field = result.error.issues[0]?.path[0];
			return fail(c, field === 'password' ? 'invalid_password' : 'invalid_email', 422);
		}),
		async c => {
			const { email, password } = c.req.valid('json');
			const { error } = await getSupabase(c).auth.signUp({ email, options: { emailRedirectTo: callbackUrl(c) }, password });
			if (error?.code === 'weak_password') return fail(c, 'weak_password', 422);
			if (error) return fail(c, 'signup_failed', 400);

			// Same answer whether or not the email is already registered (with Google or a password): no account enumeration.
			return ok(c, { message: 'If the email can be registered, a confirmation was sent.' }, 202);
		}
	)
	.post(
		'/login',
		zValidator('json', loginSchema, (result, c) => {
			if (!result.success) return fail(c, 'invalid_credentials', 401);
		}),
		async c => {
			const { email, password } = c.req.valid('json');
			const supabase = getSupabase(c);
			const { data, error } = await supabase.auth.signInWithPassword({ email, password });
			if (error?.code === 'email_not_confirmed') return fail(c, 'email_not_confirmed', 403);
			if (error || !data.user) return fail(c, 'invalid_credentials', 401);
			if (await rejectMixedProviders(supabase, data.user)) return fail(c, 'provider_conflict', 409);

			await signedIn(c, data.user);
			return ok(c, { user: publicUser(data.user) });
		}
	)
	.post('/logout', async c => {
		await getSupabase(c).auth.signOut({ scope: 'local' });
		return ok(c, { ok: true });
	})
	.get('/google', async c => {
		const { data, error } = await getSupabase(c).auth.signInWithOAuth({
			options: { redirectTo: callbackUrl(c), skipBrowserRedirect: true },
			provider: 'google',
		});
		if (error || !data.url) return fail(c, 'oauth_failed', 500);
		return c.redirect(data.url);
	})
	// Code flow for clients that cannot use the redirect: the web popup and the desktop app's system browser.
	.post('/google', zValidator('json', googleLoginSchema, validationHook), async c => {
		const idToken = await exchangeGoogleCode(c.req.valid('json'), env<GoogleBindings>(c));
		const supabase = getSupabase(c);
		const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
		if (error || !data.user) return fail(c, 'oauth_failed', 400);
		if (await rejectMixedProviders(supabase, data.user)) return fail(c, 'provider_conflict', 409);

		await signedIn(c, data.user);
		return ok(c, { user: publicUser(data.user) });
	})
	// Target of Google sign-in and of the email confirmation link (PKCE `code`).
	.get('/callback', zValidator('query', callbackQuerySchema, validationHook), async c => {
		const { code, error, error_code } = c.req.valid('query');
		// Supabase reports failures (e.g. the database blocking a second provider) as query params.
		if (error || !code) return redirectToApp(c, error_code ?? 'auth_failed');

		const supabase = getSupabase(c);
		const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
		if (exchangeError || !data.user) return redirectToApp(c, 'auth_failed');
		if (await rejectMixedProviders(supabase, data.user)) return redirectToApp(c, 'provider_conflict');

		await signedIn(c, data.user);
		return redirectToApp(c);
	})
	// Step 1 of password recovery: emails a one-time code (the Recovery template must render {{ .Token }}).
	.post(
		'/forgot-password',
		zValidator('json', forgotPasswordSchema, (result, c) => {
			// Same answer for invalid input: no account enumeration.
			if (!result.success) return ok(c, { message: 'If the email is registered, a code was sent.' }, 202);
		}),
		async c => {
			await getSupabase(c).auth.resetPasswordForEmail(c.req.valid('json').email);
			return ok(c, { message: 'If the email is registered, a code was sent.' }, 202);
		}
	)
	// Step 2: verifies the code and sets the new password. Only accounts that use a password may do this.
	.post(
		'/reset-password',
		zValidator('json', resetPasswordSchema, (result, c) => {
			if (result.success) return;
			const field = result.error.issues[0]?.path[0];
			return field === 'password' ? fail(c, 'invalid_password', 422) : fail(c, 'invalid_or_expired_code', 400);
		}),
		async c => {
			const { email, password, token } = c.req.valid('json');
			const supabase = getSupabase(c);
			const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
			if (error || !data.user) return fail(c, 'invalid_or_expired_code', 400);

			// Google-only (or mixed) accounts must never gain a password through recovery.
			const providers = providersOf(data.user);
			if (providers.size !== 1 || !providers.has('email')) {
				await supabase.auth.signOut({ scope: 'local' });
				return fail(c, 'invalid_or_expired_code', 400);
			}

			const update = await supabase.auth.updateUser({ password });
			if (update.error) return fail(c, update.error.code === 'weak_password' ? 'weak_password' : 'reset_failed', 422);

			await supabase.auth.signOut({ scope: 'others' });
			await signedIn(c, data.user);
			return ok(c, { user: publicUser(data.user) });
		}
	);
