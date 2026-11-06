import { z } from 'zod';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const email = z.preprocess(v => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email());
const newPassword = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const otpCode = z.preprocess(v => (typeof v === 'string' ? v.trim() : v), z.string().regex(/^\d{6,10}$/));

export const DISPLAY_NAME_MAX = 100;

const displayName = z.string().trim().min(1).max(DISPLAY_NAME_MAX);

export const signupSchema = z.object({ displayName, email, password: newPassword });
export const loginSchema = z.object({ email, password: z.string().min(1) });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ email, password: newPassword, token: otpCode });
export const callbackQuerySchema = z.object({
	code: z.string().optional(),
	error: z.string().optional(),
	error_code: z.string().optional(),
});

/** Authorization code from Google. `redirect_uri` + `code_verifier` are sent only by the desktop app (loopback + PKCE). */
export const googleLoginSchema = z.strictObject({
	code: z.string().min(1).max(2048),
	code_verifier: z.string().min(1).max(256).optional(),
	redirect_uri: z.url().max(2048).optional(),
});
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

// Native clients (mobile): tokens travel in the body, never in cookies. Every input is strict and bounded.

/** PKCE S256 challenge: base64url(SHA-256(verifier)), always 43 chars. */
export const nativeGoogleUrlQuerySchema = z.strictObject({ code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
/** Supabase auth code from the app-scheme redirect + the verifier generated on the device (RFC 7636: 43-128 unreserved chars). */
export const nativeGoogleLoginSchema = z.strictObject({
	code: z.string().min(1).max(512),
	code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});
export const nativeLoginSchema = z.strictObject({ email, password: z.string().min(1).max(PASSWORD_MAX) });
export const nativeSignupSchema = z.strictObject({ displayName, email, password: newPassword });
/** Email confirmation by the code of the "Confirm signup" email (the template must render {{ .Token }}). */
export const nativeVerifyEmailSchema = z.strictObject({ email, token: otpCode });
export const nativeRefreshSchema = z.strictObject({ refreshToken: z.string().min(1).max(512) });
export const nativeForgotPasswordSchema = z.strictObject({ email });
export const nativeResetPasswordSchema = z.strictObject({ email, password: newPassword, token: otpCode });
