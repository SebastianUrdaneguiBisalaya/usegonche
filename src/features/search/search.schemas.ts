import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

export const SEARCH_TYPES = ['task', 'note', 'project', 'goal', 'inbox'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** `?types=task,note` (comma separated). Omitted = every type. */
const types = z
	.string()
	.max(100)
	.transform(value => value.split(',').map(part => part.trim()))
	.pipe(z.array(z.enum(SEARCH_TYPES)).min(1))
	.transform(list => [...new Set(list)]);

export const searchQuerySchema = z.object({
	...paginationQuery,
	/** Web-search syntax: words, "quoted phrases", `or`, `-excluded`. */
	q: z.string().trim().min(1).max(200),
	types: types.optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
