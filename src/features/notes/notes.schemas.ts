import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { paginationQuery } from '../../lib/pagination.js';
import { richTextSchema } from '../../lib/rich-text.js';

const title = z.string().trim().min(1).max(200);
const ids = z
	.array(z.uuid())
	.max(50)
	.transform(values => [...new Set(values)]);

export const createNoteSchema = z.strictObject({
	body: richTextSchema.nullish(),
	/** Converts this pending inbox item into the note (atomic). */
	originInboxItemId: z.uuid().nullish(),
	projectId: z.uuid().nullish(),
	tagIds: ids.default([]),
	taskIds: ids.default([]),
	title,
});

/** `tagIds` and `taskIds` replace the whole set; `projectId: null` unlinks the project. */
export const updateNoteSchema = z
	.strictObject({
		body: richTextSchema.nullable(),
		projectId: z.uuid().nullable(),
		tagIds: ids,
		taskIds: ids,
		title,
	})
	.partial()
	.refine(hasChanges, 'empty_update');

export const listNotesQuerySchema = z.object({
	...paginationQuery,
	projectId: z.uuid().optional(),
	tagId: z.uuid().optional(),
	/** Notes linked to this task. */
	taskId: z.uuid().optional(),
});

export const noteParamSchema = z.object({ id: z.uuid() });

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesFilters = Omit<z.infer<typeof listNotesQuerySchema>, 'cursor' | 'limit'>;
