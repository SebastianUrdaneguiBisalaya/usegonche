import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { env } from 'hono/adapter';
import { z } from 'zod';
import type { AppEnv } from '../../env.js';
import { fail, ok } from '../../lib/http.js';
import { validationHook } from '../../lib/validator.js';
import {
	type NativeAuthConfig,
	nativeForgotPassword,
	nativeGoogleLogin,
	nativeGoogleUrl,
	nativeLogin,
	nativeLogout,
	nativeRefresh,
	nativeResetPassword,
	nativeSignup,
	nativeVerifyEmail,
} from './auth.native.service.js';
import {
	nativeForgotPasswordSchema,
	nativeGoogleLoginSchema,
	nativeGoogleUrlQuerySchema,
	nativeLoginSchema,
	nativeRefreshSchema,
	nativeResetPasswordSchema,
	nativeSignupSchema,
	nativeVerifyEmailSchema,
} from './auth.schemas.js';

const config = (c: Context<AppEnv>) => env<NativeAuthConfig>(c);

const bearerHeaderSchema = z.object({ authorization: z.string().regex(/^Bearer [^\s]{1,4096}$/) });

const RECOVERY_SENT = { message: 'If the email is registered, a code was sent.' };

/**
 * Token-based auth for native clients (mobile), mounted at `/auth/native`. Same rules as the cookie routes (no account enumeration,
 * one sign-in method per account, OTP password recovery), but the session is returned in the body (`accessToken`, `refreshToken`,
 * `expiresAt`, `user`) and no cookie is ever set. Every answer is `Cache-Control: no-store`. Rate limited by the `auth` scope (app.ts).
 */
export default new Hono<AppEnv>()
	.use(async (c, next) => {
		await next();
		c.header('Cache-Control', 'no-store');
	})
	.post(
		'/login',
		zValidator('json', nativeLoginSchema, (result, c) => {
			if (!result.success) return fail(c, 'invalid_credentials', 401);
		}),
		async c => ok(c, await nativeLogin(c.get('prisma'), config(c), c.req.valid('json')))
	)
	.post(
		'/signup',
		zValidator('json', nativeSignupSchema, (result, c) => {
			if (result.success) return;
			const field = result.error.issues[0]?.path[0];
			if (field === 'displayName') return fail(c, 'validation_error', 422, [{ code: 'invalid', field: 'displayName' }]);
			if (field === 'password') return fail(c, 'invalid_password', 422);
			if (field === 'email') return fail(c, 'invalid_email', 422);
			return fail(c, 'validation_error', 422);
		}),
		async c => {
			await nativeSignup(config(c), c.req.valid('json'));
			// Same answer whether or not the email is already registered: no account enumeration.
			return ok(c, { message: 'If the email can be registered, a confirmation code was sent.' }, 202);
		}
	)
	.post('/verify-email', zValidator('json', nativeVerifyEmailSchema, validationHook), async c => ok(c, await nativeVerifyEmail(c.get('prisma'), config(c), c.req.valid('json'))))
	.post('/refresh', zValidator('json', nativeRefreshSchema, validationHook), async c => ok(c, await nativeRefresh(config(c), c.req.valid('json').refreshToken)))
	.post(
		'/logout',
		zValidator('header', bearerHeaderSchema, (result, c) => {
			if (!result.success) return fail(c, 'unauthorized', 401);
		}),
		async c => {
			await nativeLogout(config(c), c.req.valid('header').authorization.slice('Bearer '.length));
			return ok(c, { ok: true });
		}
	)
	// Step 1 of Google sign-in: the Supabase authorize URL for the device's PKCE challenge, opened in the system browser.
	.get('/google', zValidator('query', nativeGoogleUrlQuerySchema, validationHook), async c => ok(c, { url: nativeGoogleUrl(config(c), c.req.valid('query').code_challenge) }))
	// Step 2: the code from the app-scheme redirect + the verifier that never left the device.
	.post('/google', zValidator('json', nativeGoogleLoginSchema, validationHook), async c => ok(c, await nativeGoogleLogin(c.get('prisma'), config(c), c.req.valid('json'))))
	.post(
		'/forgot-password',
		zValidator('json', nativeForgotPasswordSchema, (result, c) => {
			// Same answer for invalid input: no account enumeration.
			if (!result.success) return ok(c, RECOVERY_SENT, 202);
		}),
		async c => {
			await nativeForgotPassword(config(c), c.req.valid('json').email);
			return ok(c, RECOVERY_SENT, 202);
		}
	)
	.post(
		'/reset-password',
		zValidator('json', nativeResetPasswordSchema, (result, c) => {
			if (result.success) return;
			return result.error.issues[0]?.path[0] === 'password' ? fail(c, 'invalid_password', 422) : fail(c, 'invalid_or_expired_code', 400);
		}),
		async c => ok(c, await nativeResetPassword(c.get('prisma'), config(c), c.req.valid('json')))
	);
