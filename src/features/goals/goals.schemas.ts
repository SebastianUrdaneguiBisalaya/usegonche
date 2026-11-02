import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { markdownSchema } from '../../lib/markdown.js';
import { paginationQuery } from '../../lib/pagination.js';

const title = z.string().trim().min(1).max(200);
const targetDate = z.iso.date().transform(value => new Date(value));

export const goalStatuses = ['active', 'achieved'] as const;

export const createGoalSchema = z.strictObject({
	description: markdownSchema.nullish(),
	targetDate: targetDate.nullish(),
	title,
});

export const updateGoalSchema = z
	.strictObject({
		description: markdownSchema.nullable(),
		status: z.enum(goalStatuses),
		targetDate: targetDate.nullable(),
		title,
	})
	.partial()
	.refine(hasChanges, 'empty_update');

export const goalSortFields = ['createdAt', 'updatedAt', 'targetDate', 'title'] as const;
/** `overdue`: active with a target date before today. `soon`: active with a target date in the next `SOON_DAYS` days. */
export const goalDueFilters = ['overdue', 'soon'] as const;
export const SOON_DAYS = 14;

export const listGoalsQuerySchema = z.object({
	...paginationQuery,
	archived: z
		.enum(['true', 'false'])
		.default('false')
		.transform(value => value === 'true'),
	due: z.enum(goalDueFilters).optional(),
	order: z.enum(['asc', 'desc']).default('desc'),
	sort: z.enum(goalSortFields).default('createdAt'),
	status: z.enum(goalStatuses).optional(),
});

export const goalParamSchema = z.object({ id: z.uuid() });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
