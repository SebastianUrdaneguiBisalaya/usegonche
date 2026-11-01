import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';
import { richTextSchema } from '../../lib/rich-text.js';

const title = z.string().trim().min(1).max(200);
const date = z.iso.date().transform(value => new Date(value));
const estimatedMinutes = z.number().int().min(1).max(100_000);
const tagIds = z
	.array(z.uuid())
	.max(50)
	.transform(ids => [...new Set(ids)]);

export const taskStatuses = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export const taskPriorities = ['low', 'medium', 'high', 'urgent'] as const;

const dateOrder = (value: { dueDate?: Date | null; startDate?: Date | null }) => !(value.startDate && value.dueDate) || value.dueDate >= value.startDate;
const dateOrderIssue = { message: 'due_before_start', path: ['dueDate'] };

export const createTaskSchema = z
	.strictObject({
		description: richTextSchema.nullish(),
		dueDate: date.nullish(),
		estimatedMinutes: estimatedMinutes.nullish(),
		goalId: z.uuid().nullish(),
		/** Converts this pending inbox item into the task (atomic). */
		originInboxItemId: z.uuid().nullish(),
		/** Makes this a subtask. The parent must be a top-level task. */
		parentId: z.uuid().nullish(),
		priority: z.enum(taskPriorities).default('medium'),
		projectId: z.uuid().nullish(),
		startDate: date.nullish(),
		status: z.enum(['todo', 'in_progress']).default('todo'),
		tagIds: tagIds.default([]),
		title,
	})
	.refine(dateOrder, dateOrderIssue);

/** Moving to `done` sets `completedAt`; moving out of `done` clears it. `tagIds` replaces the whole set. */
export const updateTaskSchema = z
	.strictObject({
		description: richTextSchema.nullable(),
		dueDate: date.nullable(),
		estimatedMinutes: estimatedMinutes.nullable(),
		goalId: z.uuid().nullable(),
		parentId: z.uuid().nullable(),
		priority: z.enum(taskPriorities),
		projectId: z.uuid().nullable(),
		startDate: date.nullable(),
		status: z.enum(taskStatuses),
		tagIds,
		title,
	})
	.partial()
	.refine(value => Object.keys(value).length > 0, 'empty_update')
	.refine(dateOrder, dateOrderIssue);

export const listTasksQuerySchema = z.object({
	...paginationQuery,
	dueAfter: date.optional(),
	dueBefore: date.optional(),
	goalId: z.uuid().optional(),
	/** Subtasks of this task. Without it only top-level tasks are listed. */
	parentId: z.uuid().optional(),
	priority: z.enum(taskPriorities).optional(),
	projectId: z.uuid().optional(),
	status: z.enum(taskStatuses).optional(),
	tagId: z.uuid().optional(),
});

export const taskParamSchema = z.object({ id: z.uuid() });
export const dependencyParamSchema = z.object({ dependsOnId: z.uuid(), id: z.uuid() });
export const blockerParamSchema = z.object({ blockerId: z.uuid(), id: z.uuid() });

export const addDependencySchema = z.strictObject({ dependsOnId: z.uuid() });
export const createBlockerSchema = z.strictObject({ reason: z.string().trim().min(1).max(500) });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksFilters = Omit<z.infer<typeof listTasksQuerySchema>, 'cursor' | 'limit'>;
