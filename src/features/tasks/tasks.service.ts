import type { Prisma, PrismaClient, Tag, Task, TaskStatus } from '@usegonche/database';
import type { Storage } from '@usegonche/storage';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';
import { attachmentPaths, removeFiles } from '../attachments/attachments.service.js';
import { diffTaskChanges, recordTaskEvents } from '../history/history.service.js';
import { markConverted } from '../inbox/inbox.service.js';
import { getTimeZone } from '../planning/planning.shared.js';
import { createNextOccurrence } from '../recurrences/recurrences.service.js';
import { CLOSED, dueBucketWhere, OPEN, planGroups, sliceGroups, type TaskGroupPage, taskToday, WEEK_DAYS, weekEnd } from './tasks.groups.js';
import type { BulkUpdateTasksInput, CreateTaskInput, ListTasksFilters, TaskSort, UpdateTaskInput } from './tasks.schemas.js';

export type Db = PrismaClient | Prisma.TransactionClient;

/** A task plus what is derived from its relations. Blocking and progress are never stored. */
export type TaskView = Task & {
	/** Tasks that wait for this one (the reverse of `dependsOnIds`). */
	blocksIds: string[];
	/** Informational: an open manual blocker, or a dependency that is not done/cancelled yet. Never prevents any action. */
	blocked: boolean;
	dependsOnIds: string[];
	openBlockers: number;
	/** Progress from subtasks (cancelled ones are not counted). */
	progress: { done: number; total: number };
	tags: Tag[];
};

/** Open tasks per status plus `blocked` and `overdue` (open tasks only). Follows every filter but the status. */
/** `focus` is the working set: how many tasks the working-set chip would show. */
export type TaskListCounts = Record<TaskStatus | 'blocked' | 'focus' | 'overdue', number>;
/** `groups` is set when the list was grouped (`groupBy`): the groups of this page, each with the size it has in the whole filtered set. */
export type TaskPage = { counts: TaskListCounts; groups: TaskGroupPage[] | null; items: TaskView[]; total: number };

const include = {
	blockers: { select: { id: true }, where: { resolvedAt: null } },
	dependencies: { select: { dependsOn: { select: { id: true, status: true } } } },
	dependents: { select: { taskId: true } },
	subtasks: { select: { status: true } },
	tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' as const } } },
};

type Row = Task & {
	blockers: { id: string }[];
	dependencies: { dependsOn: { id: string; status: TaskStatus } }[];
	dependents: { taskId: string }[];
	subtasks: { status: TaskStatus }[];
	tags: { tag: Tag }[];
};

const FINISHED: TaskStatus[] = ['done', 'cancelled'];

const toView = ({ blockers, dependencies, dependents, subtasks, tags, ...task }: Row): TaskView => {
	const counted = subtasks.filter(subtask => subtask.status !== 'cancelled');
	return {
		...task,
		blocked: blockers.length > 0 || dependencies.some(dependency => !FINISHED.includes(dependency.dependsOn.status)),
		blocksIds: dependents.map(dependent => dependent.taskId),
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

const DAY_MS = 86_400_000;

/** The working set: what needs attention (open and overdue, due soon or undated) and what was just closed. Day boundaries come from `taskToday`. */
const focusWhere = (now: Date, timeZone: string): Prisma.TaskWhereInput => ({
	OR: [
		{ OR: [{ dueDate: null }, { dueDate: { lte: weekEnd(taskToday(now, timeZone)) } }], status: { in: OPEN } },
		{ status: { in: CLOSED }, updatedAt: { gte: new Date(now.getTime() - WEEK_DAYS * DAY_MS) } },
	],
});
/** Same rule as `TaskView.blocked`: an open manual blocker or a dependency that is not finished. */
const blockedWhere: Prisma.TaskWhereInput = { OR: [{ blockers: { some: { resolvedAt: null } } }, { dependencies: { some: { dependsOn: { status: { in: OPEN } } } } }] };
const NULLABLE_SORT: TaskSort[] = ['dueDate', 'startDate'];

/**
 * One page of tasks (newest first by default) with the total and the counters. Without `parentId` only top-level tasks are listed.
 * Counters follow every filter except the status, so each status chip shows how many tasks it would hold. `overdue`, the due groups and the working set use the user's day (their stored time zone).
 */
export const listTasks = async (prisma: PrismaClient, ownerId: string, filters: ListTasksFilters, page: PageParams): Promise<TaskPage> => {
	const {
		blocked,
		dueAfter,
		dueBefore,
		focus,
		goalId,
		groupBy = 'none',
		noDueDate,
		noProject,
		order = 'desc',
		parentId,
		priority,
		projectId,
		recurrenceId,
		sort = 'createdAt',
		status,
		tagId,
		title,
	} = filters;
	// "Today" is the user's day, in their stored time zone: the counters, the groups and the working set all read it.
	const now = new Date();
	const timeZone = await getTimeZone(prisma, ownerId);
	const shared = scoped(ownerId, {
		parentId: parentId ?? null,
		...(dueAfter || dueBefore ? { dueDate: { ...(dueAfter && { gte: dueAfter }), ...(dueBefore && { lte: dueBefore }) } } : noDueDate ? { dueDate: null } : {}),
		...(goalId && { goalId }),
		...(priority && { priority }),
		...(recurrenceId && { recurrenceId }),
		...(title && { title: { contains: title, mode: 'insensitive' as const } }),
		...(projectId ? { projectId } : noProject ? { projectId: null } : {}),
		...(tagId && { tags: { some: { tagId } } }),
		...(blocked === undefined ? {} : blocked ? blockedWhere : { NOT: blockedWhere }),
		...(focus && { AND: [focusWhere(now, timeZone)] }),
	});
	const where = { ...shared, ...(status && { status: { in: status } }) };
	const orderBy = [NULLABLE_SORT.includes(sort) ? { [sort]: { nulls: 'last', sort: order } } : { [sort]: order }, { id: order }] as Prisma.TaskOrderByWithRelationInput[];
	const today = taskToday(now, timeZone);
	// The counters (and the blocked / overdue / working-set chips) follow every filter but the status, grouped or not.
	const loadChips = () =>
		Promise.all([
			prisma.task.groupBy({ _count: { _all: true }, by: ['status'], where: shared }),
			prisma.task.count({ where: { AND: [shared, blockedWhere], status: { in: OPEN } } }),
			prisma.task.count({ where: { AND: [shared, dueBucketWhere('overdue', today)] } }),
			prisma.task.count({ where: { AND: [shared, focusWhere(now, timeZone)] } }),
		]);
	const toCounts = ([grouped, blockedCount, overdue, focusCount]: Awaited<ReturnType<typeof loadChips>>): TaskListCounts => {
		const counts: TaskListCounts = { blocked: blockedCount, cancelled: 0, done: 0, focus: focusCount, in_progress: 0, overdue, todo: 0 };
		for (const group of grouped) counts[group.status] = group._count._all;
		return counts;
	};

	if (groupBy === 'none') {
		const [rows, total, chipValues] = await Promise.all([prisma.task.findMany({ include, orderBy, ...pageArgs(page), where }), prisma.task.count({ where }), loadChips()]);
		return { counts: toCounts(chipValues), groups: null, items: rows.map(toView), total };
	}

	// Grouped: the groups are sized over the whole filtered set and laid end to end, so a page is a window over them (a group may continue on the next page).
	const plan = await planGroups(prisma, ownerId, where, groupBy, today);
	const slices = sliceGroups(plan, page);
	const [pages, chipValues] = await Promise.all([
		Promise.all(slices.map(slice => prisma.task.findMany({ include, orderBy, skip: slice.skip, take: slice.take, where: { AND: [where, slice.where] } }))),
		loadChips(),
	]);
	const groups: TaskGroupPage[] = slices.map((slice, index) => ({ count: slice.count, key: slice.key, taskIds: (pages[index] ?? []).map(row => row.id) }));
	return { counts: toCounts(chipValues), groups, items: pages.flat().map(toView), total: plan.reduce((sum, group) => sum + group.count, 0) };
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
export const updateTask = (prisma: PrismaClient, ownerId: string, id: string, input: UpdateTaskInput): Promise<TaskView> => prisma.$transaction(tx => applyUpdate(tx, ownerId, id, input));

const applyUpdate = async (tx: Db, ownerId: string, id: string, { tagIds, ...fields }: UpdateTaskInput): Promise<TaskView> => {
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
};

const shifted = (date: Date | null, days: number): Date | undefined => (date ? new Date(date.getTime() + days * DAY_MS) : undefined);

/**
 * Applies the same change to several tasks in one transaction, each one through the normal update rules (completion, history, recurrence,
 * date order). Every id must be the owner's (404 otherwise, nothing is written). `shiftDays` moves the start and due dates each task has.
 * Answers with the updated tasks in the order of `ids`.
 */
export const bulkUpdateTasks = (prisma: PrismaClient, ownerId: string, { changes, ids }: BulkUpdateTasksInput): Promise<TaskView[]> => {
	const { shiftDays, ...fields } = changes;
	return prisma.$transaction(
		async tx => {
			const current = await tx.task.findMany({ select: { dueDate: true, id: true, startDate: true }, where: scoped(ownerId, { id: { in: ids } }) });
			if (current.length !== ids.length) throw new AppError('not_found', 404);
			const byId = new Map(current.map(task => [task.id, task]));
			const result: TaskView[] = [];
			for (const id of ids) {
				const task = byId.get(id);
				const dates = shiftDays === undefined || !task ? {} : { dueDate: shifted(task.dueDate, shiftDays), startDate: shifted(task.startDate, shiftDays) };
				const update = { ...fields, ...(dates.dueDate && { dueDate: dates.dueDate }), ...(dates.startDate && { startDate: dates.startDate }) };
				result.push(hasChanges(update) ? await applyUpdate(tx, ownerId, id, update) : await getTask(tx, ownerId, id));
			}
			return result;
		},
		{ timeout: 20_000 }
	);
};

/** Deletes the task; its subtasks, dependencies, blockers, tag/note links and attachment rows cascade, and the attachment files (its and its subtasks') are removed from Storage. */
export const deleteTask = async (prisma: PrismaClient, storage: Storage, ownerId: string, id: string): Promise<void> => {
	const subtasks = await prisma.task.findMany({ select: { id: true }, where: scoped(ownerId, { parentId: id }) });
	const paths = await attachmentPaths(prisma, ownerId, { taskId: { in: [id, ...subtasks.map(subtask => subtask.id)] } });
	const { count } = await prisma.task.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
	await removeFiles(storage, paths);
};
