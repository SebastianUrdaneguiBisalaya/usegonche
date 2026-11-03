import { z } from 'zod';
import type { Translate } from '~/i18n';

/** Same bounds as the API (`profile.schemas.ts`); the API stays the authority, this only gives early, localized feedback. */
export const NAME_MAX = 100;
export const URL_MAX = 255;
export const BIO_MAX = 1000;

const isUrl = (value: string): boolean => {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
};

/** Every editable profile field as text; `''` means "empty" and is sent as `null`. Email is not part of the form (it cannot be changed). */
export const createAccountSchema = (t: Translate) => {
	const text = (max: number) => z.string().trim().max(max, t('protected.settings.account.tooLong', { max }));
	return z.object({
		bio: text(BIO_MAX),
		company: text(NAME_MAX),
		displayName: text(NAME_MAX),
		industry: text(NAME_MAX),
		jobTitle: text(NAME_MAX),
		phoneNumber: text(NAME_MAX),
		websiteUrl: z
			.string()
			.trim()
			.max(URL_MAX, t('protected.settings.account.tooLong', { max: URL_MAX }))
			.refine(value => value === '' || isUrl(value), t('protected.settings.account.invalidUrl')),
	});
};

export type AccountValues = z.infer<ReturnType<typeof createAccountSchema>>;
