import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { markdownSchema } from '../../lib/markdown.js';
import { paginationQuery } from '../../lib/pagination.js';

export const BULK_MAX = 50;
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
		description: markdownSchema.nullish(),
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
		description: markdownSchema.nullable(),
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
	.refine(hasChanges, 'empty_update')
	.refine(dateOrder, dateOrderIssue);

export const taskSortFields = ['createdAt', 'dueDate', 'priority', 'startDate', 'status', 'title', 'updatedAt'] as const;

/** `?status=todo&status=in_progress` (or one value) always ends up as a deduplicated list. */
const statusList = z.union([z.enum(taskStatuses), z.array(z.enum(taskStatuses)).min(1).max(taskStatuses.length)]).transform(value => [...new Set(Array.isArray(value) ? value : [value])]);

export const listTasksQuerySchema = z.object({
	...paginationQuery,
	/** `true` keeps blocked tasks (open manual blocker or unfinished dependency), `false` the ones that are not. */
	blocked: z
		.enum(['true', 'false'])
		.transform(value => value === 'true')
		.optional(),
	dueAfter: date.optional(),
	dueBefore: date.optional(),
	goalId: z.uuid().optional(),
	order: z.enum(['asc', 'desc']).default('desc'),
	/** `true` keeps only tasks with no due date. Ignored when `dueAfter`/`dueBefore` are given. */
	noDueDate: z
		.enum(['true'])
		.transform(() => true)
		.optional(),
	/** `true` keeps only tasks with no project. Ignored when `projectId` is given. */
	noProject: z
		.enum(['true'])
		.transform(() => true)
		.optional(),
	/** Subtasks of this task. Without it only top-level tasks are listed. */
	parentId: z.uuid().optional(),
	priority: z.enum(taskPriorities).optional(),
	projectId: z.uuid().optional(),
	sort: z.enum(taskSortFields).default('createdAt'),
	/** One or several statuses. */
	status: statusList.optional(),
	tagId: z.uuid().optional(),
});

/**
 * Same change for every selected task. Dates either are set (`startDate`/`dueDate`) or moved (`shiftDays` shifts the ones each task has);
 * the two ways cannot be mixed. Tags are not part of it.
 */
export const bulkUpdateTasksSchema = z.strictObject({
	changes: z
		.strictObject({
			dueDate: date.nullable(),
			goalId: z.uuid().nullable(),
			priority: z.enum(taskPriorities),
			projectId: z.uuid().nullable(),
			shiftDays: z
				.number()
				.int()
				.min(-3650)
				.max(3650)
				.refine(days => days !== 0, 'zero_shift'),
			startDate: date.nullable(),
			status: z.enum(taskStatuses),
		})
		.partial()
		.refine(hasChanges, 'empty_update')
		.refine(changes => changes.shiftDays === undefined || (changes.dueDate === undefined && changes.startDate === undefined), { message: 'shift_and_set_dates', path: ['shiftDays'] })
		.refine(dateOrder, dateOrderIssue),
	ids: z
		.array(z.uuid())
		.min(1)
		.max(BULK_MAX)
		.transform(ids => [...new Set(ids)]),
});

export const taskParamSchema = z.object({ id: z.uuid() });
export const dependencyParamSchema = z.object({ dependsOnId: z.uuid(), id: z.uuid() });
export const blockerParamSchema = z.object({ blockerId: z.uuid(), id: z.uuid() });

export const addDependencySchema = z.strictObject({ dependsOnId: z.uuid() });
export const createBlockerSchema = z.strictObject({ reason: z.string().trim().min(1).max(500) });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type BulkUpdateTasksInput = z.infer<typeof bulkUpdateTasksSchema>;
export type TaskSort = (typeof taskSortFields)[number];
export type ListTasksFilters = Partial<Omit<z.infer<typeof listTasksQuerySchema>, 'page' | 'pageSize'>>;
