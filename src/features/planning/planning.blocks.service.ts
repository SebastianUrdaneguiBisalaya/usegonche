import type { Prisma, PrismaClient, TimeBlock, TimeBlockStatus } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { dayRange } from '../../lib/time.js';
import { recordTaskEvents } from '../history/history.service.js';
import { availabilityIntervals, busyIntervals, datesTouched, overlaps, subtract, toInterval } from './planning.intervals.js';
import type { CreateBlockInput, MoveBlockInput, UpdateBlockInput } from './planning.schemas.js';
import { CLOSED_TASK, type Db, getTimeZone, getWindows } from './planning.shared.js';

/** Conflicts are warnings, never errors: the user decides. `refId` is the conflicting block or event. */
export type BlockWarning = { code: 'outside_availability' | 'overlaps_block' | 'overlaps_event'; refId?: string };
export type BlockWithWarnings = TimeBlock & { warnings: BlockWarning[] };

const invalid = (field: string, code: string): AppError => new AppError('validation_error', 422, [{ code, field }]);

/** Overlaps with other planned blocks and busy events, and time outside the working hours. */
export const detectWarnings = async (prisma: Db, ownerId: string, start: Date, end: Date, excludeId?: string): Promise<BlockWarning[]> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	const range = toInterval(start, end);
	const { from, to } = datesTouched(start, end, timeZone);

	const [blocks, events, windows] = await Promise.all([
		prisma.timeBlock.findMany({
			select: { id: true, plannedEnd: true, plannedStart: true },
			where: scoped(ownerId, { plannedEnd: { gt: start }, plannedStart: { lt: end }, status: 'planned' as const, ...(excludeId && { id: { not: excludeId } }) }),
		}),
		prisma.calendarEvent.findMany({ where: scoped(ownerId, { endsAt: { gt: start }, startsAt: { lt: end } }) }),
		getWindows(prisma, ownerId),
	]);

	const warnings: BlockWarning[] = [];
	for (const block of blocks) if (overlaps(range, toInterval(block.plannedStart, block.plannedEnd))) warnings.push({ code: 'overlaps_block', refId: block.id });
	for (const event of events) if (busyIntervals([event]).some(busy => overlaps(range, busy))) warnings.push({ code: 'overlaps_event', refId: event.id });
	if (subtract([range], availabilityIntervals(windows, from, to, timeZone)).length > 0) warnings.push({ code: 'outside_availability' });
	return warnings;
};

/** A block can only be planned for an existing, still open task of the owner. */
const assertOpenTask = async (prisma: Db, ownerId: string, taskId: string): Promise<void> => {
	const task = await prisma.task.findFirst({ select: { status: true }, where: scoped(ownerId, { id: taskId }) });
	if (!task) throw invalid('taskId', 'not_found');
	if ((CLOSED_TASK as readonly string[]).includes(task.status)) throw invalid('taskId', 'task_closed');
};

export const createBlock = async (prisma: PrismaClient, ownerId: string, input: CreateBlockInput): Promise<BlockWithWarnings> => {
	if (input.taskId) await assertOpenTask(prisma, ownerId, input.taskId);
	const block = await prisma.timeBlock.create({ data: { ownerId, plannedEnd: input.plannedEnd, plannedStart: input.plannedStart, taskId: input.taskId, title: input.title } });
	return { ...block, warnings: await detectWarnings(prisma, ownerId, block.plannedStart, block.plannedEnd, block.id) };
};

/** Blocks planned within the local dates `from`..`to` (inclusive), by planned start. */
export const listBlocks = async (prisma: PrismaClient, ownerId: string, from: string, to: string, status?: TimeBlockStatus): Promise<TimeBlock[]> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	return prisma.timeBlock.findMany({
		orderBy: [{ plannedStart: 'asc' }, { id: 'asc' }],
		where: scoped(ownerId, { plannedEnd: { gt: dayRange(from, timeZone).start }, plannedStart: { lt: dayRange(to, timeZone).end }, ...(status && { status }) }),
	});
};

const findOwned = async (prisma: Db, ownerId: string, id: string): Promise<TimeBlock> => {
	const block = await prisma.timeBlock.findFirst({ where: scoped(ownerId, { id }) });
	if (!block) throw new AppError('not_found', 404);
	return block;
};

export const getBlock = (prisma: PrismaClient, ownerId: string, id: string): Promise<TimeBlock> => findOwned(prisma, ownerId, id);

/**
 * Closes a planned block as `done` (actual times default to the planned ones), `missed` or `interrupted` (needs both actual times),
 * or edits the title / actual times of an already closed one. It never touches the task: finishing a block is not finishing the task.
 */
export const updateBlock = async (prisma: PrismaClient, ownerId: string, id: string, input: UpdateBlockInput): Promise<TimeBlock> => {
	const current = await findOwned(prisma, ownerId, id);
	const data: Prisma.TimeBlockUpdateManyMutationInput = {};
	if (input.title) data.title = input.title;

	if (input.status) {
		if (current.status !== 'planned') throw new AppError('invalid_state', 409);
		data.status = input.status;
		if (input.status === 'done') {
			data.actualStart = input.actualStart ?? current.plannedStart;
			data.actualEnd = input.actualEnd ?? current.plannedEnd;
		} else if (input.status === 'interrupted') {
			data.actualStart = input.actualStart;
			data.actualEnd = input.actualEnd;
		}
		if (input.status === 'missed' && (input.actualStart || input.actualEnd)) throw invalid('actualStart', 'not_allowed_for_missed');
	} else if (input.actualStart || input.actualEnd) {
		if (current.status !== 'done' && current.status !== 'interrupted') throw new AppError('invalid_state', 409);
		data.actualStart = input.actualStart;
		data.actualEnd = input.actualEnd;
	}

	const actualStart = (data.actualStart as Date | undefined) ?? current.actualStart;
	const actualEnd = (data.actualEnd as Date | undefined) ?? current.actualEnd;
	if (actualStart && actualEnd && actualEnd <= actualStart) throw invalid('actualEnd', 'end_before_start');

	await prisma.timeBlock.updateMany({ data, where: scoped(ownerId, { id }) });
	return findOwned(prisma, ownerId, id);
};

/**
 * Moving never edits the old block: it creates a new `planned` one linked through `rescheduledFromId`. A `planned` original becomes
 * `rescheduled`; a `missed` or `interrupted` one keeps its status (what happened stays on record) and is considered handled.
 * A block can be moved once: move the new one to move again. Moving a block of a task writes a `rescheduled` event to the task history.
 */
export const moveBlock = (prisma: PrismaClient, ownerId: string, id: string, input: MoveBlockInput): Promise<BlockWithWarnings> =>
	prisma.$transaction(async tx => {
		const current = await findOwned(tx, ownerId, id);
		if (!['planned', 'missed', 'interrupted'].includes(current.status)) throw new AppError('invalid_state', 409);
		if ((await tx.timeBlock.count({ where: scoped(ownerId, { rescheduledFromId: id }) })) > 0) throw new AppError('invalid_state', 409);
		if (current.taskId) await assertOpenTask(tx, ownerId, current.taskId);

		const block = await tx.timeBlock.create({
			data: { ownerId, plannedEnd: input.plannedEnd, plannedStart: input.plannedStart, rescheduledFromId: id, taskId: current.taskId, title: current.title },
		});
		if (current.status === 'planned') await tx.timeBlock.updateMany({ data: { status: 'rescheduled' }, where: scoped(ownerId, { id }) });
		if (current.taskId) {
			await recordTaskEvents(tx, ownerId, current.taskId, [
				{ fromEnd: current.plannedEnd, fromStart: current.plannedStart, timeBlockId: block.id, toEnd: block.plannedEnd, toStart: block.plannedStart, type: 'rescheduled' },
			]);
		}
		return { ...block, warnings: await detectWarnings(tx, ownerId, block.plannedStart, block.plannedEnd, block.id) };
	});

/** Only blocks that are still `planned` and were never moved can be deleted; the rest is history. */
export const deleteBlock = async (prisma: PrismaClient, ownerId: string, id: string): Promise<void> => {
	const current = await findOwned(prisma, ownerId, id);
	if (current.status !== 'planned') throw new AppError('invalid_state', 409);
	await prisma.timeBlock.deleteMany({ where: scoped(ownerId, { id, status: 'planned' as const }) });
};
