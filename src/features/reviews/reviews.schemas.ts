import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';
import { isValidDate } from '../../lib/time.js';

const calendarDate = z.string().refine(isValidDate, 'invalid_date');
const text = z.string().trim().max(5000);

export const reviewKinds = ['daily', 'weekly'] as const;

/** `date` is any local date of the period: the day itself (daily) or a day of the Monday..Sunday week (weekly). */
export const openReviewSchema = z.strictObject({ date: calendarDate, kind: z.enum(reviewKinds) });

/** Only while the review is open. `null` clears the text. */
export const updateReviewSchema = z
	.strictObject({ nextFocus: text.nullable(), reflection: text.nullable() })
	.partial()
	.refine(value => Object.keys(value).length > 0, 'empty_update');

export const closeReviewSchema = z.strictObject({ nextFocus: text.nullable().optional(), reflection: text.nullable().optional() });

const decisionSchema = z
	.strictObject({ action: z.enum(['carry_over', 'reschedule', 'drop', 'keep']), date: calendarDate.optional(), taskId: z.uuid() })
	.refine(decision => (decision.action === 'carry_over' || decision.action === 'reschedule') === Boolean(decision.date), {
		message: 'date_required_only_for_carry_over_and_reschedule',
		path: ['date'],
	});

export const decisionsSchema = z.strictObject({
	decisions: z
		.array(decisionSchema)
		.min(1)
		.max(100)
		.refine(decisions => new Set(decisions.map(decision => decision.taskId)).size === decisions.length, 'duplicate_task'),
});

export const listReviewsQuerySchema = z.object({
	...paginationQuery,
	kind: z.enum(reviewKinds).optional(),
	status: z.enum(['open', 'closed']).optional(),
});

export const reviewParamSchema = z.object({ id: z.uuid() });

export type OpenReviewInput = z.infer<typeof openReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type CloseReviewInput = z.infer<typeof closeReviewSchema>;
export type DecisionInput = z.infer<typeof decisionsSchema>['decisions'][number];
export type ListReviewsFilters = Omit<z.infer<typeof listReviewsQuerySchema>, 'cursor' | 'limit'>;
