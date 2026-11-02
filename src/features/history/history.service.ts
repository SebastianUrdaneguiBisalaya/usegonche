import type { Prisma, PrismaClient, TaskEvent, TaskPriority, TaskStatus } from '@usegonche/database';
import { changedFields } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** One variant per event type, each with its own typed from/to values (they map 1:1 to the `task_events` columns). */
export type TaskEventData =
	| { fromStatus: TaskStatus; toStatus: TaskStatus; type: 'status_changed' }
	| { fromPriority: TaskPriority; toPriority: TaskPriority; type: 'priority_changed' }
	| { fromDueDate: Date | null; toDueDate: Date | null; type: 'due_changed' }
	| { fromProjectId: string | null; toProjectId: string | null; type: 'project_changed' }
	| { fromEnd: Date; fromStart: Date; timeBlockId?: string; toEnd: Date; toStart: Date; type: 'rescheduled' };

type Tracked = { dueDate: Date | null; priority: TaskPriority; projectId: string | null; status: TaskStatus };

/** Events for the tracked fields that really change; a field that is absent or equal to the stored value produces nothing. */
export const diffTaskChanges = (before: Tracked, after: Partial<Tracked>): TaskEventData[] => {
	const changed = changedFields(before, after);
	const events: TaskEventData[] = [];
	if (changed.status !== undefined) events.push({ fromStatus: before.status, toStatus: changed.status, type: 'status_changed' });
	if (changed.priority !== undefined) events.push({ fromPriority: before.priority, toPriority: changed.priority, type: 'priority_changed' });
	if (changed.dueDate !== undefined) events.push({ fromDueDate: before.dueDate, toDueDate: changed.dueDate, type: 'due_changed' });
	if (changed.projectId !== undefined) events.push({ fromProjectId: before.projectId, toProjectId: changed.projectId, type: 'project_changed' });
	return events;
};

/**
 * Writes the events of a task. Call it with the transaction client of the change itself, so the history never disagrees with the data.
 * The actor is always `user` for now (column default).
 */
export const recordTaskEvents = async (prisma: Db, ownerId: string, taskId: string, events: TaskEventData[]): Promise<void> => {
	if (events.length === 0) return;
	await prisma.taskEvent.createMany({ data: events.map(event => ({ ...event, ownerId, taskId })) });
};

/** One page of events (newest first) with the total. 404 when the task is not the owner's. */
export const listTaskHistory = async (prisma: PrismaClient, ownerId: string, taskId: string, page: PageParams): Promise<Paged<TaskEvent>> => {
	if (!(await prisma.task.findFirst({ select: { id: true }, where: scoped(ownerId, { id: taskId }) }))) throw new AppError('not_found', 404);
	const where = scoped(ownerId, { taskId });
	const [items, total] = await Promise.all([prisma.taskEvent.findMany({ orderBy: pageOrder('occurredAt'), ...pageArgs(page), where }), prisma.taskEvent.count({ where })]);
	return { items, total };
};
