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
		language: z
			.string()
			.regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/)
			.max(10),
		theme: z.enum(THEMES),
		timezone: z.string().max(64).refine(isIanaTimezone),
	})
	.partial()
	.refine(hasChanges);

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
