import { z } from 'zod';
import type { Translate } from '~/i18n';
import { taskPriorities } from '../tasks/search-params';
import { frequencies, weekdays } from './rule';

/** Same bounds as the API (`recurrences.schemas.ts`); the API stays the authority, this only gives early, localized feedback. */
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 100_000;

/** Numbers stay text while typing; `time` is `HH:MM` or empty and `startDate` is `YYYY-MM-DD`. */
export const recurrenceFormSchema = (t: Translate) =>
	z
		.object({
			byDay: z.array(z.enum(weekdays)),
			description: z.string().max(DESCRIPTION_MAX),
			duration: z.string().regex(/^\d*$/),
			estimate: z.string().regex(/^\d*$/),
			freq: z.enum(frequencies),
			goalId: z.string(),
			interval: z
				.string()
				.regex(/^\d+$/, t('recurrences.form.interval.invalid'))
				.refine(value => Number(value) >= 1 && Number(value) <= 999, t('recurrences.form.interval.invalid')),
			priority: z.enum(taskPriorities),
			projectId: z.string(),
			startDate: z.string().min(1, t('recurrences.form.startDate.required')),
			tagIds: z.array(z.string()),
			time: z.string(),
			title: z
				.string()
				.trim()
				.min(1, t('recurrences.form.title.required'))
				.max(TITLE_MAX, t('recurrences.form.title.tooLong', { max: TITLE_MAX })),
		})
		.refine(value => (value.time === '') === (value.duration === '' || Number(value.duration) < 1), { message: t('recurrences.form.time.needsDuration'), path: ['duration'] })
		.refine(value => value.duration === '' || (Number(value.duration) >= 1 && Number(value.duration) <= 1440), { message: t('recurrences.form.duration.invalid'), path: ['duration'] });

export type RecurrenceFormValues = z.infer<ReturnType<typeof recurrenceFormSchema>>;
