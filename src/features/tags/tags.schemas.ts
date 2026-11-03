import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

const name = z.string().trim().min(1).max(50);

export const createTagSchema = z.strictObject({ name });
export const updateTagSchema = z.strictObject({ name });
export const tagSortFields = ['name', 'createdAt', 'updatedAt', 'tasks', 'projects', 'notes'] as const;

/** `q` keeps the tags whose name contains it; `tasks` / `projects` / `notes` sort by how many of them use the tag. */
export const listTagsQuerySchema = z.object({
	...paginationQuery,
	order: z.enum(['asc', 'desc']).default('asc'),
	q: z.string().trim().max(50).optional(),
	sort: z.enum(tagSortFields).default('name'),
});

export const tagParamSchema = z.object({ id: z.uuid() });

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
