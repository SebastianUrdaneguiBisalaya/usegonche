import { z } from 'zod';
import type { Translate } from '~/i18n';
import { projectStatuses } from './search-params';

/** Same bounds as the API (`projects.schemas.ts`, `markdown.ts`); the API stays the authority, this only gives early, localized feedback. */
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 100_000;

/** `goalId: ''` means "no goal"; the description is Markdown text. */
export const createProjectFormSchema = (t: Translate) =>
	z.object({
		description: z.string().max(DESCRIPTION_MAX),
		goalId: z.string(),
		status: z.enum(projectStatuses),
		tagIds: z.array(z.string()),
		title: z
			.string()
			.trim()
			.min(1, t('projects.form.title.required'))
			.max(TITLE_MAX, t('projects.form.title.tooLong', { max: TITLE_MAX })),
	});

export type ProjectFormValues = z.infer<ReturnType<typeof createProjectFormSchema>>;
