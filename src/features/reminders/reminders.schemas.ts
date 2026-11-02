import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { paginationQuery } from '../../lib/pagination.js';

const remindAt = z.iso.datetime({ offset: true }).transform(value => new Date(value));
const targets = ['taskId', 'eventId', 'noteId'] as const;

/** Exactly one target: a task, a calendar event or a note. `remindAt` is an absolute instant, independent of any due date. */
export const createReminderSchema = z
	.strictObject({ eventId: z.uuid().optional(), noteId: z.uuid().optional(), remindAt, taskId: z.uuid().optional() })
	.refine(value => targets.filter(key => value[key] !== undefined).length === 1, { message: 'exactly_one_target', path: ['taskId'] });

/** Reschedules a pending reminder. Sent or dismissed ones are not edited: snooze them instead. */
export const updateReminderSchema = z.strictObject({ remindAt }).partial().refine(hasChanges, 'empty_update');

export const snoozeReminderSchema = z.strictObject({ remindAt });

export const listRemindersQuerySchema = z.object({
	...paginationQuery,
	eventId: z.uuid().optional(),
	noteId: z.uuid().optional(),
	status: z.enum(['pending', 'sent', 'dismissed']).optional(),
	taskId: z.uuid().optional(),
});

export const reminderParamSchema = z.object({ id: z.uuid() });

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersQuerySchema>;
