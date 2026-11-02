import { z } from 'zod';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const email = z.preprocess(v => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email());
const newPassword = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const otpCode = z.preprocess(v => (typeof v === 'string' ? v.trim() : v), z.string().regex(/^\d{6,10}$/));

export const signupSchema = z.object({ email, password: newPassword });
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
