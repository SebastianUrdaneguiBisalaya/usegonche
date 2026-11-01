import type { CalendarEvent, PrismaClient, Task, TimeBlock } from '@usegonche/database';
import { valuesEqual } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { dayRange } from '../../lib/time.js';
import { type BlockWarning, detectWarnings } from './planning.blocks.service.js';
import { availabilityIntervals, busyIntervals, clip, minutesOf, subtract, toInterval } from './planning.intervals.js';
import { CLOSED_TASK, type Db, getTimeZone, getWindows } from './planning.shared.js';

export type DayTask = Pick<Task, 'dueDate' | 'estimatedMinutes' | 'id' | 'priority' | 'status' | 'title'>;
export type DayItem = { id: string; position: number; task: DayTask };

/** Planned vs available minutes. Explainable on purpose: every figure is a plain sum, nothing is a score. */
export type Capacity = {
	/** Working hours of the weekday, before events. */
	workingMinutes: number;
	/** Working hours minus out-of-office and timed events. */
	availableMinutes: number;
	/** Estimates of the plan's tasks that are still open (done/cancelled ones are not counted). */
	plannedMinutes: number;
	/** Open tasks of the plan without an estimate: they add 0 to `plannedMinutes`. */
	unestimatedTasks: number;
	/** Time already put into planned time blocks within the day. */
	scheduledMinutes: number;
	/** `availableMinutes - plannedMinutes` (negative when overcommitted). */
	remainingMinutes: number;
	overcommitted: boolean;
};

export type DayView = {
	blocks: (TimeBlock & { warnings: BlockWarning[] })[];
	capacity: Capacity;
	date: string;
	events: CalendarEvent[];
	items: DayItem[];
	timezone: string;
};

const taskSelect = { dueDate: true, estimatedMinutes: true, id: true, priority: true, status: true, title: true } as const;

/** Everything about one local day: planned tasks, events, time blocks (with warnings) and the capacity summary. */
export const getDay = async (prisma: Db, ownerId: string, date: string): Promise<DayView> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	const { end, start } = dayRange(date, timeZone);
	const day = toInterval(start, end);

	const [windows, events, blocks, plan] = await Promise.all([
		getWindows(prisma, ownerId),
		prisma.calendarEvent.findMany({ orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], where: scoped(ownerId, { endsAt: { gt: start }, startsAt: { lt: end } }) }),
		prisma.timeBlock.findMany({ orderBy: [{ plannedStart: 'asc' }, { id: 'asc' }], where: scoped(ownerId, { plannedEnd: { gt: start }, plannedStart: { lt: end } }) }),
		prisma.dailyPlan.findFirst({ include: { items: { include: { task: { select: taskSelect } }, orderBy: { position: 'asc' } } }, where: scoped(ownerId, { date: new Date(date) }) }),
	]);

	const working = availabilityIntervals(windows, date, date, timeZone);
	const available = subtract(working, busyIntervals(events));
	const items: DayItem[] = (plan?.items ?? []).map(item => ({ id: item.id, position: item.position, task: item.task }));
	const open = items.filter(item => !(CLOSED_TASK as readonly string[]).includes(item.task.status));
	const plannedMinutes = open.reduce((total, item) => total + (item.task.estimatedMinutes ?? 0), 0);
	const availableMinutes = minutesOf(available);
	const scheduledMinutes = minutesOf(
		blocks
			.filter(block => block.status === 'planned')
			.map(block => clip(toInterval(block.plannedStart, block.plannedEnd), day))
			.filter((interval): interval is NonNullable<typeof interval> => interval !== null)
	);

	const withWarnings = await Promise.all(
		blocks.map(async block => ({ ...block, warnings: block.status === 'planned' ? await detectWarnings(prisma, ownerId, block.plannedStart, block.plannedEnd, block.id) : [] }))
	);

	return {
		blocks: withWarnings,
		capacity: {
			availableMinutes,
			overcommitted: plannedMinutes > availableMinutes,
			plannedMinutes,
			remainingMinutes: availableMinutes - plannedMinutes,
			scheduledMinutes,
			unestimatedTasks: open.filter(item => item.task.estimatedMinutes === null).length,
			workingMinutes: minutesOf(working),
		},
		date,
		events,
		items,
		timezone: timeZone,
	};
};

/**
 * Replaces the day's task list, in order. Tasks must be the owner's; tasks added now must still be open (a task already in the plan
 * stays even if it was finished since, so the day keeps its history).
 */
export const setDayItems = (prisma: PrismaClient, ownerId: string, date: string, taskIds: string[]): Promise<DayView> =>
	prisma.$transaction(async tx => {
		const tasks = await tx.task.findMany({ select: { id: true, status: true }, where: scoped(ownerId, { id: { in: taskIds } }) });
		if (tasks.length !== taskIds.length) throw new AppError('validation_error', 422, [{ code: 'not_found', field: 'taskIds' }]);

		const plan = await tx.dailyPlan.upsert({
			create: { date: new Date(date), ownerId },
			select: { id: true, items: { orderBy: { position: 'asc' }, select: { taskId: true } } },
			update: {},
			where: { ownerId_date: { date: new Date(date), ownerId } },
		});
		const already = new Set(plan.items.map(item => item.taskId));
		if (tasks.some(task => !already.has(task.id) && (CLOSED_TASK as readonly string[]).includes(task.status)))
			throw new AppError('validation_error', 422, [{ code: 'task_closed', field: 'taskIds' }]);

		if (
			valuesEqual(
				plan.items.map(item => item.taskId),
				taskIds
			)
		)
			return getDay(tx, ownerId, date);

		await tx.dailyPlanItem.deleteMany({ where: scoped(ownerId, { planId: plan.id }) });
		if (taskIds.length > 0) await tx.dailyPlanItem.createMany({ data: taskIds.map((taskId, position) => ({ ownerId, planId: plan.id, position, taskId })) });
		return getDay(tx, ownerId, date);
	});
