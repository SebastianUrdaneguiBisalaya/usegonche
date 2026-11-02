import { z } from 'zod';
import type { Translate } from '~/i18n';
import { goalStatuses } from './search-params';

/** Same bounds as the API (`goals.schemas.ts`, `markdown.ts`); the API stays the authority, this only gives early, localized feedback. */
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 100_000;

/** `targetDate: ''` means "no target date", otherwise a `YYYY-MM-DD` day; the description is Markdown text. */
export const createGoalFormSchema = (t: Translate) =>
	z.object({
		description: z.string().max(DESCRIPTION_MAX),
		status: z.enum(goalStatuses),
		targetDate: z.string(),
		title: z
			.string()
			.trim()
			.min(1, t('goals.form.title.required'))
			.max(TITLE_MAX, t('goals.form.title.tooLong', { max: TITLE_MAX })),
	});

export type GoalFormValues = z.infer<ReturnType<typeof createGoalFormSchema>>;
