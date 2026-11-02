import type { Prisma, PrismaClient, Reminder } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';
import type { CreateReminderInput, ListRemindersQuery, SnoozeReminderInput, UpdateReminderInput } from './reminders.schemas.js';

/** Reminders claimed per processor run; a backlog drains over the following runs (the job runs every minute). */
export const PROCESS_BATCH_SIZE = 100;

export type ProcessResult = { claimed: number; failed: number };

const invalid = (field: string, code: string): AppError => new AppError('validation_error', 422, [{ code, field }]);

const assertTarget = async (prisma: PrismaClient, ownerId: string, input: CreateReminderInput): Promise<Pick<Prisma.ReminderUncheckedCreateInput, 'calendarEventId' | 'noteId' | 'taskId'>> => {
	if (input.taskId) {
		if (!(await prisma.task.findFirst({ select: { id: true }, where: scoped(ownerId, { id: input.taskId }) }))) throw invalid('taskId', 'not_found');
		return { taskId: input.taskId };
	}
	if (input.eventId) {
		if (!(await prisma.calendarEvent.findFirst({ select: { id: true }, where: scoped(ownerId, { id: input.eventId }) }))) throw invalid('eventId', 'not_found');
		return { calendarEventId: input.eventId };
	}
	if (input.noteId && !(await prisma.note.findFirst({ select: { id: true }, where: scoped(ownerId, { id: input.noteId }) }))) throw invalid('noteId', 'not_found');
	return { noteId: input.noteId };
};

export const listReminders = async (prisma: PrismaClient, ownerId: string, query: Omit<ListRemindersQuery, 'page' | 'pageSize'>, page: PageParams): Promise<Paged<Reminder>> => {
	const where = scoped(ownerId, { calendarEventId: query.eventId, noteId: query.noteId, status: query.status, taskId: query.taskId });
	const [items, total] = await Promise.all([prisma.reminder.findMany({ orderBy: pageOrder('remindAt'), ...pageArgs(page), where }), prisma.reminder.count({ where })]);
	return { items, total };
};

export const getReminder = async (prisma: PrismaClient, ownerId: string, id: string): Promise<Reminder> => {
	const reminder = await prisma.reminder.findFirst({ where: scoped(ownerId, { id }) });
	if (!reminder) throw new AppError('not_found', 404);
	return reminder;
};

export const createReminder = async (prisma: PrismaClient, ownerId: string, input: CreateReminderInput): Promise<Reminder> =>
	prisma.reminder.create({ data: { ownerId, remindAt: input.remindAt, ...(await assertTarget(prisma, ownerId, input)) } });

export const updateReminder = async (prisma: PrismaClient, ownerId: string, id: string, input: UpdateReminderInput): Promise<Reminder> => {
	const reminder = await getReminder(prisma, ownerId, id);
	if (reminder.status !== 'pending') throw new AppError('invalid_state', 409);
	// Conditional on `pending`: if the processor claims it in between, the update matches nothing instead of resurrecting it.
	const { count } = await prisma.reminder.updateMany({ data: { remindAt: input.remindAt }, where: scoped(ownerId, { id, status: 'pending' as const }) });
	if (count === 0) throw new AppError('invalid_state', 409);
	return getReminder(prisma, ownerId, id);
};

/** Postpones a pending or sent reminder: new `remindAt`, back to `pending`. A dismissed one stays dismissed. */
export const snoozeReminder = async (prisma: PrismaClient, ownerId: string, id: string, input: SnoozeReminderInput): Promise<Reminder> => {
	const { count } = await prisma.reminder.updateMany({
		data: { dismissedAt: null, remindAt: input.remindAt, sentAt: null, snoozeCount: { increment: 1 }, status: 'pending' },
		where: scoped(ownerId, { id, status: { in: ['pending', 'sent'] as ('pending' | 'sent')[] } }),
	});
	if (count === 0) {
		await getReminder(prisma, ownerId, id); // 404 when it is not the user's
		throw new AppError('invalid_state', 409);
	}
	return getReminder(prisma, ownerId, id);
};

/** Dismisses a pending or sent reminder (idempotent for an already dismissed one). */
export const dismissReminder = async (prisma: PrismaClient, ownerId: string, id: string, now: Date = new Date()): Promise<Reminder> => {
	await prisma.reminder.updateMany({ data: { dismissedAt: now, status: 'dismissed' }, where: scoped(ownerId, { id, status: { in: ['pending', 'sent'] as ('pending' | 'sent')[] } }) });
	return getReminder(prisma, ownerId, id);
};

export const deleteReminder = async (prisma: PrismaClient, ownerId: string, id: string): Promise<void> => {
	const { count } = await prisma.reminder.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
};

/** Pending reminders whose time has come, oldest first, across every owner (used by the internal processor only). */
export const findDueReminders = async (prisma: PrismaClient, now: Date, limit: number = PROCESS_BATCH_SIZE): Promise<Reminder[]> =>
	prisma.reminder.findMany({ orderBy: [{ remindAt: 'asc' }, { id: 'asc' }], take: limit, where: { remindAt: { lte: now }, status: 'pending' } });

/**
 * Claims one reminder: `pending -> sent` in a single conditional update. Only the run whose update matches a row gets it,
 * so overlapping runs or retries never deliver twice.
 */
export const claimReminder = async (prisma: PrismaClient, id: string, now: Date): Promise<boolean> =>
	(await prisma.reminder.updateMany({ data: { sentAt: now, status: 'sent' }, where: { id, remindAt: { lte: now }, status: 'pending' } })).count === 1;

/** A failed delivery goes back to `pending` (only if it is still the claim we made) so the next run retries it. */
const release = async (prisma: PrismaClient, id: string, now: Date): Promise<void> => {
	await prisma.reminder.updateMany({ data: { sentAt: null, status: 'pending' }, where: { id, sentAt: now, status: 'sent' } });
};

/** Claims every due reminder and hands each claimed one to `deliver`. */
export const processDueReminders = async (prisma: PrismaClient, deliver: (reminder: Reminder) => Promise<void>, now: Date = new Date()): Promise<ProcessResult> => {
	const result: ProcessResult = { claimed: 0, failed: 0 };
	for (const reminder of await findDueReminders(prisma, now)) {
		if (!(await claimReminder(prisma, reminder.id, now))) continue;
		try {
			await deliver({ ...reminder, sentAt: now, status: 'sent' });
			result.claimed++;
		} catch {
			result.failed++;
			await release(prisma, reminder.id, now);
		}
	}
	return result;
};
