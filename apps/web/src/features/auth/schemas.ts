import { z } from 'zod';
import type { Translate } from '~/i18n';

/** Same bounds as the API (`auth.schemas.ts`); the API stays the authority, this only gives early, localized feedback. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
/** Digits of the recovery code Supabase emails (the API accepts 6 to 10). */
export const OTP_LENGTH = 6;

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

export const createSignInSchema = (t: Translate) =>
	z.object({
		email: email(t),
		password: z.string().min(1, t('auth.common.password.required')),
	});

export const createSignUpSchema = (t: Translate) =>
	z.object({
		email: email(t),
		password: newPassword(t),
	});

export const createForgotPasswordSchema = (t: Translate) =>
	z.object({
		email: email(t),
	});

export const createResetPasswordSchema = (t: Translate) =>
	z
		.object({
			code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), t('auth.resetPassword.code.invalid')),
			confirm_password: z.string(),
			password: newPassword(t),
		})
		.refine(data => data.password === data.confirm_password, {
			message: t('auth.resetPassword.confirmPassword.mismatch'),
			path: ['confirm_password'],
		});
