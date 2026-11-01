import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { paginationQuery } from '../../lib/pagination.js';
import { richTextSchema } from '../../lib/rich-text.js';

const title = z.string().trim().min(1).max(200);
const targetDate = z.iso.date().transform(value => new Date(value));

export const goalStatuses = ['active', 'achieved'] as const;

export const createGoalSchema = z.strictObject({
	description: richTextSchema.nullish(),
	targetDate: targetDate.nullish(),
	title,
});

export const updateGoalSchema = z
	.strictObject({
		description: richTextSchema.nullable(),
		status: z.enum(goalStatuses),
		targetDate: targetDate.nullable(),
		title,
	})
	.partial()
	.refine(hasChanges, 'empty_update');

export const listGoalsQuerySchema = z.object({
	...paginationQuery,
	archived: z
		.enum(['true', 'false'])
		.default('false')
		.transform(value => value === 'true'),
	status: z.enum(goalStatuses).optional(),
});

export const goalParamSchema = z.object({ id: z.uuid() });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
