import { z } from 'zod';
import { isValidDate } from '../../lib/time.js';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export const nextQuerySchema = z.object({
	/** Local date to suggest for. Defaults to today in the user's timezone. */
	date: z.string().refine(isValidDate, 'invalid_date').optional(),
	limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});
