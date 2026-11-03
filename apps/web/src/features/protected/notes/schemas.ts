import { z } from 'zod';
import type { Translate } from '~/i18n';

/** Same bounds as the API (`notes.schemas.ts`, `markdown.ts`); the API stays the authority, this only gives early, localized feedback. */
export const TITLE_MAX = 200;
export const BODY_MAX = 100_000;

/** "New note": only the title is required; the rest is set in the editor. */
export const createNoteFormSchema = (t: Translate) =>
	z.object({
		title: z
			.string()
			.trim()
			.min(1, t('notes.form.title.required'))
			.max(TITLE_MAX, t('notes.form.title.tooLong', { max: TITLE_MAX })),
	});

/** Limits of the files of one note. Client-side only: the API bounds each file (50 MB) but not their number or total. */
export const FILES_MAX = 10;
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const FILES_TOTAL_MAX_BYTES = 50 * 1024 * 1024;
