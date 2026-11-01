import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { paginationQuery } from '../../lib/pagination.js';
import { richTextSchema } from '../../lib/rich-text.js';

const title = z.string().trim().min(1).max(200);
const date = z.iso.date().transform(value => new Date(value));
const tagIds = z
	.array(z.uuid())
	.max(50)
	.transform(ids => [...new Set(ids)]);

/** Whole template: top-level items and subtasks together. Bounds the number of rows one request can write. */
export const MAX_TEMPLATE_ITEMS = 200;

const itemFields = {
	description: richTextSchema.nullish(),
	/** Days after the start date given when instantiating (the task's due date). */
	dueOffsetDays: z.number().int().min(0).max(3650).nullish(),
	estimatedMinutes: z.number().int().min(1).max(100_000).nullish(),
	priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
	tagIds: tagIds.default([]),
	title,
};

const subtaskSchema = z.strictObject(itemFields);
/** A task of the template; its `subtasks` are single level, like real tasks. */
export const templateItemSchema = z.strictObject({ ...itemFields, subtasks: z.array(subtaskSchema).max(20).default([]) });
export type TemplateItemInput = z.infer<typeof templateItemSchema>;

const name = z.string().trim().min(1).max(100);
const itemCount = (items: TemplateItemInput[]): number => items.reduce((total, item) => total + 1 + item.subtasks.length, 0);
const withinLimit = (items: TemplateItemInput[]): boolean => itemCount(items) <= MAX_TEMPLATE_ITEMS;
const limitIssue = { message: 'too_many_items' };

/** `task`: one task with its subtasks. `project`: the project's own fields plus its tasks. */
export const createTemplateSchema = z.discriminatedUnion('kind', [
	z.strictObject({ item: templateItemSchema, kind: z.literal('task'), name }).refine(value => withinLimit([value.item]), { ...limitIssue, path: ['item'] }),
	z
		.strictObject({
			description: richTextSchema.nullish(),
			items: z.array(templateItemSchema).min(1).max(50),
			kind: z.literal('project'),
			name,
			tagIds: tagIds.default([]),
			title,
		})
		.refine(value => withinLimit(value.items), { ...limitIssue, path: ['items'] }),
]);

/**
 * The kind never changes. `item` (task templates) and `items` (project templates) replace the whole structure when sent;
 * `title`, `description` and `tagIds` only apply to project templates; `tagIds` replaces the set.
 */
export const updateTemplateSchema = z
	.strictObject({
		description: richTextSchema.nullable(),
		item: templateItemSchema,
		items: z.array(templateItemSchema).min(1).max(50),
		name,
		tagIds,
		title,
	})
	.partial()
	.refine(hasChanges, 'empty_update')
	.refine(value => withinLimit(value.items ?? (value.item ? [value.item] : [])), { ...limitIssue, path: ['items'] });

/** `title` renames the created task (task templates) or project (project templates); `projectId` is for task templates only. */
export const instantiateTemplateSchema = z.strictObject({
	goalId: z.uuid().nullish(),
	projectId: z.uuid().nullish(),
	/** Day the offsets count from. Required when the template has any `dueOffsetDays`. */
	startDate: date.nullish(),
	title: title.nullish(),
});

export const listTemplatesQuerySchema = z.object({ ...paginationQuery, kind: z.enum(['task', 'project']).optional() });
export const templateParamSchema = z.object({ id: z.uuid() });

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type InstantiateTemplateInput = z.infer<typeof instantiateTemplateSchema>;
