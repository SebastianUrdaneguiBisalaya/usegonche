import type { PrismaClient } from '@usegonche/database';
import { scoped } from '../../lib/owner.js';
import { addDays, dayRange } from '../../lib/time.js';
import { availabilityIntervals, busyIntervals, type Interval, subtract, toInterval } from './planning.intervals.js';
import { CLOSED_TASK, getTimeZone, getWindows } from './planning.shared.js';

const MINUTE_MS = 60_000;

export type ReplanProposal = {
	blockId: string;
	durationMinutes: number;
	reason: 'interrupted' | 'missed';
	/** `null` when no free slot fits in the search window. */
	suggestedEnd: Date | null;
	suggestedStart: Date | null;
	taskId: string | null;
	title: string | null;
};

/**
 * Proposals only, never applied: for each `missed` / `interrupted` block of the local `date` that has not been moved yet, the first
 * free slot (working hours minus busy events and planned blocks, never in the past) that fits what is left to do. The user accepts one
 * by calling `POST /planning/blocks/:id/move` with the suggested range. Blocks of finished/cancelled tasks are skipped.
 */
export const proposeReplan = async (prisma: PrismaClient, ownerId: string, date: string, days: number, now: Date = new Date()): Promise<ReplanProposal[]> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	const day = dayRange(date, timeZone);
	const horizon = dayRange(addDays(date, days), timeZone).end;

	const pending = await prisma.timeBlock.findMany({
		include: { task: { select: { status: true } } },
		orderBy: [{ plannedStart: 'asc' }, { id: 'asc' }],
		where: scoped(ownerId, {
			plannedEnd: { gt: day.start },
			plannedStart: { lt: day.end },
			rescheduledTo: { none: {} },
			status: { in: ['missed', 'interrupted'] as ('missed' | 'interrupted')[] },
		}),
	});
	const candidates = pending.filter(block => !block.task || !(CLOSED_TASK as readonly string[]).includes(block.task.status));
	if (candidates.length === 0) return [];

	const searchFrom = new Date(Math.max(day.start.getTime(), now.getTime()));
	const [windows, events, planned] = await Promise.all([
		getWindows(prisma, ownerId),
		prisma.calendarEvent.findMany({ where: scoped(ownerId, { endsAt: { gt: searchFrom }, startsAt: { lt: horizon } }) }),
		prisma.timeBlock.findMany({
			select: { plannedEnd: true, plannedStart: true },
			where: scoped(ownerId, { plannedEnd: { gt: searchFrom }, plannedStart: { lt: horizon }, status: 'planned' as const }),
		}),
	]);

	let free: Interval[] = subtract(subtract(availabilityIntervals(windows, date, addDays(date, days), timeZone), [{ end: searchFrom.getTime(), start: Number.NEGATIVE_INFINITY }]), [
		...busyIntervals(events),
		...planned.map(block => toInterval(block.plannedStart, block.plannedEnd)),
	]);

	const proposals: ReplanProposal[] = [];
	for (const block of candidates) {
		const plannedMs = block.plannedEnd.getTime() - block.plannedStart.getTime();
		const doneMs = block.status === 'interrupted' && block.actualStart && block.actualEnd ? block.actualEnd.getTime() - block.actualStart.getTime() : 0;
		const remaining = plannedMs - doneMs;
		if (remaining <= 0) continue;

		const slot = free.find(interval => interval.end - interval.start >= remaining);
		const taken = slot ? { end: slot.start + remaining, start: slot.start } : null;
		if (taken) free = subtract(free, [taken]);
		proposals.push({
			blockId: block.id,
			durationMinutes: Math.round(remaining / MINUTE_MS),
			reason: block.status === 'interrupted' ? 'interrupted' : 'missed',
			suggestedEnd: taken ? new Date(taken.end) : null,
			suggestedStart: taken ? new Date(taken.start) : null,
			taskId: block.taskId,
			title: block.title,
		});
	}
	return proposals;
};
