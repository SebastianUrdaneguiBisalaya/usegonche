import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform(v => (v === '' ? null : v))
		.nullable();

const isIanaTimezone = (value: string): boolean => {
	try {
		new Intl.DateTimeFormat('en', { timeZone: value });
		return true;
	} catch {
		return false;
	}
};

export const THEMES = ['light', 'dark', 'system'] as const;

/** Partial update: only the fields sent change; `null` (or an empty string) clears a field. */
export const updateProfileSchema = z
	.strictObject({
		avatarUrl: z.url().max(2048).nullable(),
		bio: optionalText(1000),
		company: optionalText(100),
		displayName: optionalText(100),
		industry: optionalText(100),
		jobTitle: optionalText(100),
		phoneNumber: optionalText(100),
		websiteUrl: z.url().max(255).nullable(),
	})
	.partial()
	.refine(hasChanges);

export const updateSettingsSchema = z
	.strictObject({
		country: optionalText(100),
		// `system` follows the device's language; otherwise a language code like `en` or `es-PE`.
		language: z
			.string()
			.regex(/^(system|[a-z]{2,3}(-[A-Za-z0-9]{2,8})?)$/)
			.max(10),
		/** Finishes the mandatory onboarding. Needs theme, language, country and time zone to be set (422 `onboarding_incomplete` otherwise); it cannot be undone. */
		onboardingCompleted: z.literal(true),
		theme: z.enum(THEMES),
		timezone: z.string().max(64).refine(isIanaTimezone),
	})
	.partial()
	.refine(hasChanges);

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Asks for a signed URL to upload the avatar straight to Storage (public bucket). */
export const avatarUploadSchema = z.strictObject({
	mimeType: z.enum(AVATAR_MIME_TYPES),
	sizeBytes: z.number().int().min(1).max(AVATAR_MAX_BYTES),
});

export type AvatarUploadInput = z.infer<typeof avatarUploadSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
