import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

export const CONTENT_MAX = 2000;
export const BRAIN_DUMP_MAX_ITEMS = 200;

const content = z.string().trim().min(1).max(CONTENT_MAX);

/** One non-empty line per item; blank lines are dropped. */
export const splitLines = (text: string): string[] =>
	text
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);

export const captureSchema = z.strictObject({ content });

/** Input is the raw text; the validated output is the list of lines (one inbox item each). */
export const brainDumpSchema = z.strictObject({
	text: z
		.string()
		.max(CONTENT_MAX * BRAIN_DUMP_MAX_ITEMS)
		.transform(splitLines)
		.pipe(z.array(content).min(1).max(BRAIN_DUMP_MAX_ITEMS)),
});

/** `converted` is not user-settable: it only happens through the conversion to a task, project or note. */
export const userStatuses = ['pending', 'archived', 'discarded'] as const;
export const setStatusSchema = z.strictObject({ status: z.enum(userStatuses) });

export const listQuerySchema = z.object({
	...paginationQuery,
	status: z.enum(['pending', 'converted', 'archived', 'discarded']).default('pending'),
});

export const inboxParamSchema = z.object({ id: z.uuid() });

export type UserStatus = (typeof userStatuses)[number];
