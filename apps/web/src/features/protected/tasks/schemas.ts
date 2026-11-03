import { z } from 'zod';
import type { Translate } from '~/i18n';
import { taskPriorities } from './search-params';

/** Same bounds as the API (`tasks.schemas.ts`, `markdown.ts`); the API stays the authority, this only gives early, localized feedback. */
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 100_000;

/** `projectId: ''` / `goalId: ''` mean "none"; `dueDate` is `YYYY-MM-DD` or empty; the description is Markdown text. */
export const createTaskFormSchema = (t: Translate) =>
	z.object({
		description: z.string().max(DESCRIPTION_MAX),
		dueDate: z.string(),
		goalId: z.string(),
		priority: z.enum(taskPriorities),
		projectId: z.string(),
		status: z.enum(['todo', 'in_progress']),
		tagIds: z.array(z.string()),
		title: z
			.string()
			.trim()
			.min(1, t('tasks.form.title.required'))
			.max(TITLE_MAX, t('tasks.form.title.tooLong', { max: TITLE_MAX })),
	});

export type TaskFormValues = z.infer<ReturnType<typeof createTaskFormSchema>>;
