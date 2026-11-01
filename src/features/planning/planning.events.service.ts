import type { CalendarEvent, PrismaClient } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { dayRange, localDateOf, zonedToUtc } from '../../lib/time.js';
import type { CreateEventInput, UpdateEventInput } from './planning.schemas.js';
import { getTimeZone } from './planning.shared.js';

const invalid = (field: string, code: string): AppError => new AppError('validation_error', 422, [{ code, field }]);

/** Events overlapping the local dates `from`..`to` (inclusive), by start time. */
export const listEvents = async (prisma: PrismaClient, ownerId: string, from: string, to: string): Promise<CalendarEvent[]> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	return prisma.calendarEvent.findMany({
		orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
		where: scoped(ownerId, { endsAt: { gt: dayRange(from, timeZone).start }, startsAt: { lt: dayRange(to, timeZone).end } }),
	});
};

const findOwned = async (prisma: PrismaClient, ownerId: string, id: string): Promise<CalendarEvent> => {
	const event = await prisma.calendarEvent.findFirst({ where: scoped(ownerId, { id }) });
	if (!event) throw new AppError('not_found', 404);
	return event;
};

export const getEvent = (prisma: PrismaClient, ownerId: string, id: string): Promise<CalendarEvent> => findOwned(prisma, ownerId, id);

/** All-day events cover whole local days: from the start of `startDate` to the end of `endDate`, in the user's timezone. */
export const createEvent = async (prisma: PrismaClient, ownerId: string, input: CreateEventInput): Promise<CalendarEvent> => {
	const timeZone = await getTimeZone(prisma, ownerId);
	const range = input.allDay
		? { endsAt: zonedToUtc(input.endDate ?? input.startDate, 1440, timeZone), startsAt: zonedToUtc(input.startDate, 0, timeZone) }
		: { endsAt: input.endsAt, startsAt: input.startsAt };
	return prisma.calendarEvent.create({ data: { allDay: input.allDay, kind: input.kind, ownerId, title: input.title, ...range } });
};

/** Writes only what changed; an update that changes nothing answers with the current event and writes nothing. */
export const updateEvent = async (prisma: PrismaClient, ownerId: string, id: string, input: UpdateEventInput): Promise<CalendarEvent> => {
	const current = await findOwned(prisma, ownerId, id);
	const timeZone = await getTimeZone(prisma, ownerId);
	const allDay = input.allDay ?? current.allDay;
	const touchesRange = input.allDay !== undefined || input.startsAt || input.endsAt || input.startDate || input.endDate;
	let range: { endsAt: Date; startsAt: Date } | undefined;

	if (touchesRange && allDay) {
		const startDate = input.startDate ?? (current.allDay ? localDateOf(current.startsAt, timeZone) : undefined);
		const endDate = input.endDate ?? (current.allDay ? localDateOf(new Date(current.endsAt.getTime() - 1), timeZone) : startDate);
		if (!startDate) throw invalid('startDate', 'required');
		if (endDate && endDate < startDate) throw invalid('endDate', 'end_before_start');
		range = { endsAt: zonedToUtc(endDate ?? startDate, 1440, timeZone), startsAt: zonedToUtc(startDate, 0, timeZone) };
	} else if (touchesRange) {
		const startsAt = input.startsAt ?? (current.allDay ? undefined : current.startsAt);
		const endsAt = input.endsAt ?? (current.allDay ? undefined : current.endsAt);
		if (!startsAt) throw invalid('startsAt', 'required');
		if (!endsAt) throw invalid('endsAt', 'required');
		if (endsAt <= startsAt) throw invalid('endsAt', 'end_before_start');
		range = { endsAt, startsAt };
	}

	const changed = changedFields(current, { allDay, ...(input.kind && { kind: input.kind }), ...(input.title && { title: input.title }), ...range });
	if (!hasChanges(changed)) return current;
	await prisma.calendarEvent.updateMany({ data: changed, where: scoped(ownerId, { id }) });
	return findOwned(prisma, ownerId, id);
};

export const deleteEvent = async (prisma: PrismaClient, ownerId: string, id: string): Promise<void> => {
	const { count } = await prisma.calendarEvent.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
};
