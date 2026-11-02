import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { markdownSchema } from '../../lib/markdown.js';
import { paginationQuery } from '../../lib/pagination.js';

const title = z.string().trim().min(1).max(200);
const tagIds = z
	.array(z.uuid())
	.max(50)
	.transform(ids => [...new Set(ids)]);

export const projectStatuses = ['active', 'on_hold', 'completed'] as const;

export const createProjectSchema = z.strictObject({
	description: markdownSchema.nullish(),
	goalId: z.uuid().nullish(),
	/** Converts this pending inbox item into the project (atomic). */
	originInboxItemId: z.uuid().nullish(),
	tagIds: tagIds.default([]),
	title,
});

/** `tagIds` replaces the whole tag set; `goalId: null` unlinks the goal. */
export const updateProjectSchema = z
	.strictObject({
		description: markdownSchema.nullable(),
		goalId: z.uuid().nullable(),
		status: z.enum(projectStatuses),
		tagIds,
		title,
	})
	.partial()
	.refine(hasChanges, 'empty_update');

export const listProjectsQuerySchema = z.object({
	...paginationQuery,
	archived: z
		.enum(['true', 'false'])
		.default('false')
		.transform(value => value === 'true'),
	goalId: z.uuid().optional(),
	status: z.enum(projectStatuses).optional(),
});

export const projectParamSchema = z.object({ id: z.uuid() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
