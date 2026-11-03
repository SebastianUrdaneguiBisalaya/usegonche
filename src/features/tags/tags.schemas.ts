import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { paginationQuery } from '../../lib/pagination.js';

const name = z.string().trim().min(1).max(50);

/** `#rrggbb`, as the web color picker sends it (any case is accepted and stored in lowercase). */
const color = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.string().regex(/^#[0-9a-f]{6}$/, 'invalid_color'));

export const createTagSchema = z.strictObject({ color: color.nullish(), name });
/** `color: null` removes the color. */
export const updateTagSchema = z.strictObject({ color: color.nullable(), name }).partial().refine(hasChanges, 'empty_update');
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
