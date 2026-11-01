import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { paginationQuery } from '../../lib/pagination.js';
import { richTextSchema } from '../../lib/rich-text.js';
import { buildRule } from './recurrences.rrule.js';

const date = z.iso.date().transform(value => new Date(value));
const tagIds = z
	.array(z.uuid())
	.max(50)
	.transform(ids => [...new Set(ids)]);

/** RFC 5545 RRULE without DTSTART, e.g. `FREQ=WEEKLY;BYDAY=MO,WE`. Daily or slower frequencies only. */
const rule = z
	.string()
	.trim()
	.min(1)
	.max(500)
	.refine(value => buildRule(value, new Date(0)) !== null, 'invalid_rule');

const startMinute = z.number().int().min(0).max(1439);
const durationMinutes = z.number().int().min(1).max(1440);
const priority = z.enum(['low', 'medium', 'high', 'urgent']);

export const createRecurrenceSchema = z
	.strictObject({
		description: richTextSchema.nullish(),
		durationMinutes: durationMinutes.nullish(),
		estimatedMinutes: z.number().int().min(1).max(100_000).nullish(),
		goalId: z.uuid().nullish(),
		priority: priority.default('medium'),
		projectId: z.uuid().nullish(),
		rule,
		/** First possible day (the rule's DTSTART). */
		startDate: date,
		/** Local start time as minutes from midnight (540 = 9:00 am). With `durationMinutes`, every occurrence gets a planned time block. */
		startMinute: startMinute.nullish(),
		tagIds: tagIds.default([]),
		title: z.string().trim().min(1).max(200),
	})
	.refine(value => (value.startMinute == null) === (value.durationMinutes == null), { message: 'time_requires_duration', path: ['durationMinutes'] });

/** `startMinute` and `durationMinutes` must end up both set or both null. Applies to future occurrences that are still `todo`; past, started and finished occurrences are never touched. `tagIds` replaces the whole set. */
export const updateRecurrenceSchema = z
	.strictObject({
		description: richTextSchema.nullable(),
		durationMinutes: durationMinutes.nullable(),
		estimatedMinutes: z.number().int().min(1).max(100_000).nullable(),
		goalId: z.uuid().nullable(),
		priority,
		projectId: z.uuid().nullable(),
		rule,
		startDate: date,
		startMinute: startMinute.nullable(),
		tagIds,
		title: z.string().trim().min(1).max(200),
	})
	.partial()
	.refine(hasChanges, 'empty_update');

export const listRecurrencesQuerySchema = z.object({ ...paginationQuery });
export const recurrenceParamSchema = z.object({ id: z.uuid() });

export type CreateRecurrenceInput = z.infer<typeof createRecurrenceSchema>;
export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;
