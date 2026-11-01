import { z } from 'zod';
import { isValidDate } from '../../lib/time.js';

const calendarDate = z.string().refine(isValidDate, 'invalid_date');

/**
 * Local dates (`YYYY-MM-DD`, inclusive) in the user's timezone. Without `to` it is today; without `from` it is 30 days before `to`; at most 366 days.
 * The optional filters narrow every metric to the tasks of a project, goal, tag or priority.
 */
export const rangeQuerySchema = z.object({
	from: calendarDate.optional(),
	goalId: z.uuid().optional(),
	priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
	projectId: z.uuid().optional(),
	tagId: z.uuid().optional(),
	to: calendarDate.optional(),
});

export const throughputQuerySchema = z.object({ ...rangeQuerySchema.shape, granularity: z.enum(['day', 'week']).default('day') });

export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type ThroughputQuery = z.infer<typeof throughputQuerySchema>;
