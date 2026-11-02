import type { Prisma, PrismaClient, Tag, Task, TaskStatus } from '@usegonche/database';
import type { Storage } from '@usegonche/storage';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';
import { attachmentPaths, removeFiles } from '../attachments/attachments.service.js';
import { diffTaskChanges, recordTaskEvents } from '../history/history.service.js';
import { markConverted } from '../inbox/inbox.service.js';
import { createNextOccurrence } from '../recurrences/recurrences.service.js';
import type { CreateTaskInput, ListTasksFilters, UpdateTaskInput } from './tasks.schemas.js';

export type Db = PrismaClient | Prisma.TransactionClient;

/** A task plus what is derived from its relations. Blocking and progress are never stored. */
export type TaskView = Task & {
	/** Informational: an open manual blocker, or a dependency that is not done/cancelled yet. Never prevents any action. */
	blocked: boolean;
	dependsOnIds: string[];
	openBlockers: number;
	/** Progress from subtasks (cancelled ones are not counted). */
	progress: { done: number; total: number };
	tags: Tag[];
};

const include = {
	blockers: { select: { id: true }, where: { resolvedAt: null } },
	dependencies: { select: { dependsOn: { select: { id: true, status: true } } } },
	subtasks: { select: { status: true } },
	tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' as const } } },
};

type Row = Task & {
	blockers: { id: string }[];
	dependencies: { dependsOn: { id: string; status: TaskStatus } }[];
	subtasks: { status: TaskStatus }[];
	tags: { tag: Tag }[];
};

const FINISHED: TaskStatus[] = ['done', 'cancelled'];

const toView = ({ blockers, dependencies, subtasks, tags, ...task }: Row): TaskView => {
	const counted = subtasks.filter(subtask => subtask.status !== 'cancelled');
	return {
		...task,
		blocked: blockers.length > 0 || dependencies.some(dependency => !FINISHED.includes(dependency.dependsOn.status)),
		dependsOnIds: dependencies.map(dependency => dependency.dependsOn.id),
		openBlockers: blockers.length,
		progress: { done: counted.filter(subtask => subtask.status === 'done').length, total: counted.length },
		tags: tags.map(link => link.tag),
	};
};

const invalidReference = (field: string, code = 'not_found'): AppError => new AppError('validation_error', 422, [{ code, field }]);

const assertProject = async (prisma: Db, ownerId: string, projectId: string): Promise<void> => {
	if (!(await prisma.project.findFirst({ select: { id: true }, where: scoped(ownerId, { id: projectId }) }))) throw invalidReference('projectId');
};

const assertGoal = async (prisma: Db, ownerId: string, goalId: string): Promise<void> => {
	if (!(await prisma.goal.findFirst({ select: { id: true }, where: scoped(ownerId, { id: goalId }) }))) throw invalidReference('goalId');
};

const assertTags = async (prisma: Db, ownerId: string, tagIds: string[]): Promise<void> => {
	if (tagIds.length === 0) return;
	if ((await prisma.tag.count({ where: scoped(ownerId, { id: { in: tagIds } }) })) !== tagIds.length) throw invalidReference('tagIds');
};

/** Subtasks are single level: the parent must be the owner's and top-level, and a task that has subtasks cannot become a subtask. */
const assertParent = async (prisma: Db, ownerId: string, parentId: string, taskId?: string): Promise<void> => {
	if (parentId === taskId) throw invalidReference('parentId', 'self_parent');
	const parent = await prisma.task.findFirst({ select: { id: true, parentId: true }, where: scoped(ownerId, { id: parentId }) });
	if (!parent) throw invalidReference('parentId');
	if (parent.parentId) throw invalidReference('parentId', 'nested_subtask');
	if (taskId && (await prisma.task.count({ where: scoped(ownerId, { parentId: taskId }) })) > 0) throw invalidReference('parentId', 'has_subtasks');
};

/** One page of tasks (newest first) with the total. Without `parentId` only top-level tasks are listed. */
export const listTasks = async (prisma: PrismaClient, ownerId: string, filters: ListTasksFilters, page: PageParams): Promise<Paged<TaskView>> => {
	const { dueAfter, dueBefore, goalId, parentId, priority, projectId, status, tagId } = filters;
	const where = scoped(ownerId, {
		parentId: parentId ?? null,
		...(dueAfter || dueBefore ? { dueDate: { ...(dueAfter && { gte: dueAfter }), ...(dueBefore && { lte: dueBefore }) } } : {}),
		...(goalId && { goalId }),
		...(priority && { priority }),
		...(projectId && { projectId }),
		...(status && { status }),
		...(tagId && { tags: { some: { tagId } } }),
	});
	const [rows, total] = await Promise.all([prisma.task.findMany({ include, orderBy: pageOrder('createdAt'), ...pageArgs(page), where }), prisma.task.count({ where })]);
	return { items: rows.map(toView), total };
};

export const getTask = async (prisma: Db, ownerId: string, id: string): Promise<TaskView> => {
	const task = await prisma.task.findFirst({ include, where: scoped(ownerId, { id }) });
	if (!task) throw new AppError('not_found', 404);
	return toView(task);
};

/** With `originInboxItemId` the inbox item is marked converted in the same transaction (404 if not the owner's, 409 if not pending). */
export const createTask = (prisma: PrismaClient, ownerId: string, input: CreateTaskInput): Promise<TaskView> =>
	prisma.$transaction(async tx => {
		if (input.projectId) await assertProject(tx, ownerId, input.projectId);
		if (input.goalId) await assertGoal(tx, ownerId, input.goalId);
		if (input.parentId) await assertParent(tx, ownerId, input.parentId);
		await assertTags(tx, ownerId, input.tagIds);
		if (input.originInboxItemId) await markConverted(tx, ownerId, input.originInboxItemId);
		const { id } = await tx.task.create({
			data: {
				description: input.description,
				dueDate: input.dueDate,
				estimatedMinutes: input.estimatedMinutes,
				goalId: input.goalId,
				origin: input.originInboxItemId ? 'inbox' : 'manual',
				originInboxItemId: input.originInboxItemId,
				ownerId,
				parentId: input.parentId,
				priority: input.priority,
				projectId: input.projectId,
				startDate: input.startDate,
				status: input.status,
				tags: { create: input.tagIds.map(tagId => ({ tagId })) },
				title: input.title,
			},
			select: { id: true },
		});
		return getTask(tx, ownerId, id);
	});

/**
 * Completion rules: entering `done` sets `completedAt`; leaving `done` (reopen) or going to `cancelled` clears it.
 * Dates are validated against the stored ones (due >= start). Changes of status, priority, due date and project are written to the task
 * history in the same transaction. Only what really changed is written (tags are compared as a set): an update that changes nothing
 * answers with the current task, with no write, no `updatedAt` bump and no history event.
 */
export const updateTask = (prisma: PrismaClient, ownerId: string, id: string, { tagIds, ...fields }: UpdateTaskInput): Promise<TaskView> =>
	prisma.$transaction(async tx => {
		const current = await tx.task.findFirst({ include: { tags: { select: { tagId: true } } }, where: scoped(ownerId, { id }) });
		if (!current) throw new AppError('not_found', 404);

		const { tagIds: newTagIds, ...changes } = changedFields({ ...current, tagIds: current.tags.map(link => link.tagId) }, { ...fields, tagIds }, { unordered: ['tagIds'] });
		if (!hasChanges(changes) && !newTagIds) return getTask(tx, ownerId, id);

		const startDate = changes.startDate === undefined ? current.startDate : changes.startDate;
		const dueDate = changes.dueDate === undefined ? current.dueDate : changes.dueDate;
		if (startDate && dueDate && dueDate < startDate) throw invalidReference('dueDate', 'due_before_start');

		if (changes.projectId) await assertProject(tx, ownerId, changes.projectId);
		if (changes.goalId) await assertGoal(tx, ownerId, changes.goalId);
		if (changes.parentId) await assertParent(tx, ownerId, changes.parentId, id);
		if (newTagIds) await assertTags(tx, ownerId, newTagIds);

		if (hasChanges(changes)) {
			const completedAt = changes.status === undefined ? undefined : changes.status === 'done' ? new Date() : null;
			await tx.task.updateMany({ data: { ...changes, completedAt }, where: scoped(ownerId, { id }) });
			await recordTaskEvents(tx, ownerId, id, diffTaskChanges(current, changes));
			if (current.recurrenceId && current.occurrenceDate && changes.status && FINISHED.includes(changes.status))
				await createNextOccurrence(tx, ownerId, current.recurrenceId, current.occurrenceDate);
		}
		if (newTagIds) {
			await tx.taskTag.deleteMany({ where: { taskId: id } });
			await tx.taskTag.createMany({ data: newTagIds.map(tagId => ({ tagId, taskId: id })) });
		}
		return getTask(tx, ownerId, id);
	});

/** Deletes the task; its subtasks, dependencies, blockers, tag/note links and attachment rows cascade, and the attachment files (its and its subtasks') are removed from Storage. */
export const deleteTask = async (prisma: PrismaClient, storage: Storage, ownerId: string, id: string): Promise<void> => {
	const subtasks = await prisma.task.findMany({ select: { id: true }, where: scoped(ownerId, { parentId: id }) });
	const paths = await attachmentPaths(prisma, ownerId, { taskId: { in: [id, ...subtasks.map(subtask => subtask.id)] } });
	const { count } = await prisma.task.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
	await removeFiles(storage, paths);
};
