import { z } from 'zod';
import type { Translate } from '~/i18n';

/** Same bound as the API (`tags.schemas.ts`); the API stays the authority, this only gives early, localized feedback. */
export const NAME_MAX = 50;

/** `color: ''` means "no color", otherwise the `#rrggbb` the user picked. */
export const createEditSchema = (t: Translate) =>
	z.object({
		color: z.string(),
		name: z
			.string()
			.trim()
			.min(1, t('tags.edit.required'))
			.max(NAME_MAX, t('tags.edit.tooLong', { max: NAME_MAX })),
	});

export type EditValues = z.infer<ReturnType<typeof createEditSchema>>;
