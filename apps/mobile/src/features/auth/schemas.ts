import { z } from 'zod';
import type { TranslationKey } from '@/i18n';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

/** Same bounds as the API (`auth.schemas.ts`); the API stays the authority, this only gives early, localized feedback. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
/** Digits of the codes Supabase emails (the API accepts 6 to 10). */
export const OTP_LENGTH = 6;
export const DISPLAY_NAME_MAX = 100;

const email = (t: Translate) =>
	z
		.string()
		.trim()
		.toLowerCase()
		.pipe(z.email(t('auth.common.email.invalid')));
const newPassword = (t: Translate) =>
	z
		.string()
		.min(PASSWORD_MIN, t('auth.common.password.tooShort', { min: PASSWORD_MIN }))
		.max(PASSWORD_MAX, t('auth.common.password.tooLong', { max: PASSWORD_MAX }));
const code = (t: Translate) =>
	z
		.string()
		.trim()
		.regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), t('auth.resetPassword.code.invalid'));

export const createSignInSchema = (t: Translate) =>
	z.object({
		email: email(t),
		password: z.string().min(1, t('auth.common.password.required')),
	});

export const createSignUpSchema = (t: Translate) =>
	z.object({
		displayName: z
			.string()
			.trim()
			.min(1, t('auth.common.displayName.required'))
			.max(DISPLAY_NAME_MAX, t('auth.common.displayName.tooLong', { max: DISPLAY_NAME_MAX })),
		email: email(t),
		password: newPassword(t),
	});

export const createForgotPasswordSchema = (t: Translate) => z.object({ email: email(t) });

export const createVerifyEmailSchema = (t: Translate) => z.object({ token: code(t) });

export const createResetPasswordSchema = (t: Translate) =>
	z
		.object({
			confirmPassword: z.string(),
			password: newPassword(t),
			token: code(t),
		})
		.refine(values => values.password === values.confirmPassword, {
			message: t('auth.resetPassword.confirmPassword.mismatch'),
			path: ['confirmPassword'],
		});

/** First message per field, for inline errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const field = String(issue.path[0] ?? '');
		errors[field] ??= issue.message;
	}
	return errors;
}
