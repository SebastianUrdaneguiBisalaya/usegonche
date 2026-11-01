import type { User } from '@supabase/supabase-js';
import { type Context, Hono } from 'hono';
import { env } from 'hono/adapter';
import { getSupabase, type SupabaseBindings } from './hono.js';
import { providersOf, rejectMixedProviders } from './policy.js';

export type AuthBindings = SupabaseBindings & {
	/** Absolute URL of `GET {mount}/callback` on this API. Defaults to the request origin (set it behind proxies). */
	AUTH_CALLBACK_URL?: string;
	/** Where the browser lands after Google sign-in / email confirmation. `?error=<code>` is appended on failure. */
	AUTH_REDIRECT_URL?: string;
};

export type AuthRoutesOptions = {
	/** Runs after every successful sign-in (password, Google, password reset). Use it to upsert the app profile. */
	onSignIn?: (user: User, c: Context) => Promise<void>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

const readBody = async (c: Context): Promise<Record<string, unknown>> => {
	try {
		const body = await c.req.json();
		return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	} catch {
		return {};
	}
};

const asEmail = (value: unknown): string | null => {
	const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
	return EMAIL.test(email) ? email : null;
};

const asPassword = (value: unknown): string | null => (typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX ? value : null);

const asCode = (value: unknown): string | null => (typeof value === 'string' && /^\d{6,10}$/.test(value.trim()) ? value.trim() : null);

const publicUser = (user: User) => ({ email: user.email, id: user.id });

/**
 * Email + password and Google authentication, plus OTP-code password recovery.
 * Requires `supabaseMiddleware()` to run before it. Mount it, e.g. `app.route('/auth', createAuthRoutes())`.
 *
 * Rules: Google creates the account on first sign-in; an email can only ever use one sign-in method;
 * passwords are changed only through a one-time code sent to the email (forgot password).
 */
export function createAuthRoutes(options: AuthRoutesOptions = {}) {
	const app = new Hono<{ Bindings: AuthBindings }>();

	const callbackUrl = (c: Context) => env<AuthBindings>(c).AUTH_CALLBACK_URL ?? new URL('/auth/callback', c.req.url).toString();

	const finish = async (c: Context, user: User) => {
		await options.onSignIn?.(user, c);
	};

	const redirectToApp = (c: Context, error?: string) => {
		const base = env<AuthBindings>(c).AUTH_REDIRECT_URL;
		if (!base) return error ? c.json({ error }, 400) : c.json({ ok: true });
		const url = new URL(base);
		if (error) url.searchParams.set('error', error);
		return c.redirect(url.toString());
	};

	app.post('/signup', async c => {
		const body = await readBody(c);
		const email = asEmail(body.email);
		const password = asPassword(body.password);
		if (!email) return c.json({ error: 'invalid_email' }, 422);
		if (!password) return c.json({ error: 'invalid_password', message: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.` }, 422);

		const { error } = await getSupabase(c).auth.signUp({ email, options: { emailRedirectTo: callbackUrl(c) }, password });
		if (error && error.code === 'weak_password') return c.json({ error: 'weak_password' }, 422);
		if (error) return c.json({ error: 'signup_failed' }, 400);

		// Same answer whether or not the email is already registered (with Google or a password): no account enumeration.
		return c.json({ message: 'If the email can be registered, a confirmation was sent.' }, 202);
	});

	app.post('/login', async c => {
		const body = await readBody(c);
		const email = asEmail(body.email);
		const password = typeof body.password === 'string' ? body.password : null;
		if (!email || !password) return c.json({ error: 'invalid_credentials' }, 401);

		const supabase = getSupabase(c);
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error?.code === 'email_not_confirmed') return c.json({ error: 'email_not_confirmed' }, 403);
		if (error || !data.user) return c.json({ error: 'invalid_credentials' }, 401);
		if (await rejectMixedProviders(supabase, data.user)) return c.json({ error: 'provider_conflict' }, 409);

		await finish(c, data.user);
		return c.json({ user: publicUser(data.user) });
	});

	app.post('/logout', async c => {
		await getSupabase(c).auth.signOut({ scope: 'local' });
		return c.json({ ok: true });
	});

	app.get('/google', async c => {
		const { data, error } = await getSupabase(c).auth.signInWithOAuth({
			options: { redirectTo: callbackUrl(c), skipBrowserRedirect: true },
			provider: 'google',
		});
		if (error || !data.url) return c.json({ error: 'oauth_failed' }, 500);
		return c.redirect(data.url);
	});

	// Target of Google sign-in and of the email confirmation link (PKCE `code`).
	app.get('/callback', async c => {
		const code = c.req.query('code');
		// Supabase reports failures (e.g. the database blocking a second provider) as query params.
		if (c.req.query('error') || !code) return redirectToApp(c, c.req.query('error_code') ?? 'auth_failed');

		const supabase = getSupabase(c);
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		if (error || !data.user) return redirectToApp(c, 'auth_failed');
		if (await rejectMixedProviders(supabase, data.user)) return redirectToApp(c, 'provider_conflict');

		await finish(c, data.user);
		return redirectToApp(c);
	});

	// Step 1 of password recovery: emails a one-time code (the Recovery template must render {{ .Token }}).
	app.post('/forgot-password', async c => {
		const email = asEmail((await readBody(c)).email);
		if (email) await getSupabase(c).auth.resetPasswordForEmail(email);
		return c.json({ message: 'If the email is registered, a code was sent.' }, 202);
	});

	// Step 2: verifies the code and sets the new password. Only accounts that use a password may do this.
	app.post('/reset-password', async c => {
		const body = await readBody(c);
		const email = asEmail(body.email);
		const token = asCode(body.token);
		const password = asPassword(body.password);
		if (!email || !token) return c.json({ error: 'invalid_or_expired_code' }, 400);
		if (!password) return c.json({ error: 'invalid_password', message: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.` }, 422);

		const supabase = getSupabase(c);
		const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
		if (error || !data.user) return c.json({ error: 'invalid_or_expired_code' }, 400);

		// Google-only (or mixed) accounts must never gain a password through recovery.
		const providers = providersOf(data.user);
		if (providers.size !== 1 || !providers.has('email')) {
			await supabase.auth.signOut({ scope: 'local' });
			return c.json({ error: 'invalid_or_expired_code' }, 400);
		}

		const update = await supabase.auth.updateUser({ password });
		if (update.error) return c.json({ error: update.error.code === 'weak_password' ? 'weak_password' : 'reset_failed' }, 422);

		await supabase.auth.signOut({ scope: 'others' });
		await finish(c, data.user);
		return c.json({ user: publicUser(data.user) });
	});

	return app;
}
