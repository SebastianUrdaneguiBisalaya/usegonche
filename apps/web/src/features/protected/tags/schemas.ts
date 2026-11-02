import { z } from 'zod';
import type { Translate } from '~/i18n';

/** Same bound as the API (`tags.schemas.ts`); the API stays the authority, this only gives early, localized feedback. */
export const NAME_MAX = 50;

export const createRenameSchema = (t: Translate) =>
	z.object({
		name: z
			.string()
			.trim()
			.min(1, t('tags.rename.required'))
			.max(NAME_MAX, t('tags.rename.tooLong', { max: NAME_MAX })),
	});

export type RenameValues = z.infer<ReturnType<typeof createRenameSchema>>;
