import type { CalendarEvent } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createEvent, deleteEvent, getEvent, listEvents, updateEvent } from './planning.events.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const timed = { allDay: false, endsAt: new Date('2026-11-02T11:00:00Z'), id: ID, kind: 'event', ownerId: TEST_USER_ID, startsAt: new Date('2026-11-02T10:00:00Z'), title: 'Sync' } as CalendarEvent;
const allDay = { ...timed, allDay: true, endsAt: new Date('2026-11-04T00:00:00Z'), startsAt: new Date('2026-11-02T00:00:00Z') } as CalendarEvent;

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);
const lima = (prisma: ReturnType<typeof createMockPrisma>) => vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ timezone: 'America/Lima' } as never);

describe('listEvents', () => {
	it('lists events overlapping the local days, scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([timed]);
		expect(await listEvents(prisma, TEST_USER_ID, '2026-11-02', '2026-11-03')).toEqual([timed]);
		expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith({
			orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
			where: { endsAt: { gt: new Date('2026-11-02T00:00:00Z') }, ownerId: TEST_USER_ID, startsAt: { lt: new Date('2026-11-04T00:00:00Z') } },
		});
	});

	it('uses the user timezone for the day boundaries', async () => {
		const prisma = createMockPrisma();
		lima(prisma);
		vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
		await listEvents(prisma, TEST_USER_ID, '2026-11-02', '2026-11-02');
		expect(vi.mocked(prisma.calendarEvent.findMany).mock.calls[0]?.[0]?.where).toMatchObject({
			endsAt: { gt: new Date('2026-11-02T05:00:00Z') },
			startsAt: { lt: new Date('2026-11-03T05:00:00Z') },
		});
	});
});

describe('createEvent', () => {
	it('stores a timed event as given', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.create).mockResolvedValue(timed);
		await createEvent(prisma, TEST_USER_ID, { allDay: false, endsAt: timed.endsAt, kind: 'event', startsAt: timed.startsAt, title: 'Sync' });
		expect(prisma.calendarEvent.create).toHaveBeenCalledWith({ data: { allDay: false, endsAt: timed.endsAt, kind: 'event', ownerId: TEST_USER_ID, startsAt: timed.startsAt, title: 'Sync' } });
	});

	it('stores an all-day event as whole local days (end date inclusive)', async () => {
		const prisma = createMockPrisma();
		lima(prisma);
		vi.mocked(prisma.calendarEvent.create).mockResolvedValue(allDay);
		await createEvent(prisma, TEST_USER_ID, { allDay: true, endDate: '2026-11-03', kind: 'out_of_office', startDate: '2026-11-02', title: 'Trip' });
		expect(prisma.calendarEvent.create).toHaveBeenCalledWith({
			data: { allDay: true, endsAt: new Date('2026-11-04T05:00:00Z'), kind: 'out_of_office', ownerId: TEST_USER_ID, startsAt: new Date('2026-11-02T05:00:00Z'), title: 'Trip' },
		});
	});

	it('defaults the end date to the start date', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.create).mockResolvedValue(allDay);
		await createEvent(prisma, TEST_USER_ID, { allDay: true, kind: 'event', startDate: '2026-11-02', title: 'Holiday' });
		expect(prisma.calendarEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ endsAt: new Date('2026-11-03T00:00:00Z'), startsAt: new Date('2026-11-02T00:00:00Z') }) });
	});
});

describe('getEvent', () => {
	it('returns the event of the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(timed);
		expect(await getEvent(prisma, TEST_USER_ID, ID)).toBe(timed);
	});

	it('throws 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(null);
		expect(await rejection(getEvent(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.calendarEvent.findFirst).toHaveBeenCalledWith({ where: { id: ID, ownerId: OTHER_USER_ID } });
	});
});

describe('updateEvent', () => {
	it('changes the title only, leaving the range alone', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(timed);
		await updateEvent(prisma, TEST_USER_ID, ID, { title: 'New' });
		expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({ data: { title: 'New' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('is idempotent: the stored title and range answer the event and write nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(timed);
		expect(await updateEvent(prisma, TEST_USER_ID, ID, { endsAt: new Date(timed.endsAt), kind: 'event', startsAt: new Date(timed.startsAt), title: 'Sync' })).toBe(timed);
		expect(prisma.calendarEvent.updateMany).not.toHaveBeenCalled();
	});

	it('is idempotent for all-day events too (same dates)', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(allDay);
		expect(await updateEvent(prisma, TEST_USER_ID, ID, { allDay: true, endDate: '2026-11-03', startDate: '2026-11-02' })).toBe(allDay);
		expect(prisma.calendarEvent.updateMany).not.toHaveBeenCalled();
	});

	it('merges a partial timed range with the stored one', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(timed);
		const endsAt = new Date('2026-11-02T12:00:00Z');
		await updateEvent(prisma, TEST_USER_ID, ID, { endsAt });
		expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({ data: { endsAt }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('rejects an end before the start', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(timed);
		expect(await rejection(updateEvent(prisma, TEST_USER_ID, ID, { endsAt: new Date('2026-11-02T09:00:00Z') }))).toMatchObject({
			details: [{ code: 'end_before_start', field: 'endsAt' }],
			status: 422,
		});
		expect(prisma.calendarEvent.updateMany).not.toHaveBeenCalled();
	});

	it('converts a timed event to all-day when dates are given, and requires them', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(timed);
		await updateEvent(prisma, TEST_USER_ID, ID, { allDay: true, startDate: '2026-11-05' });
		expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({
			data: { allDay: true, endsAt: new Date('2026-11-06T00:00:00Z'), startsAt: new Date('2026-11-05T00:00:00Z') },
			where: { id: ID, ownerId: TEST_USER_ID },
		});

		expect(await rejection(updateEvent(prisma, TEST_USER_ID, ID, { allDay: true }))).toMatchObject({ details: [{ code: 'required', field: 'startDate' }] });
	});

	it('converts an all-day event to timed only with both instants', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(allDay);
		expect(await rejection(updateEvent(prisma, TEST_USER_ID, ID, { allDay: false, startsAt: timed.startsAt }))).toMatchObject({ details: [{ code: 'required', field: 'endsAt' }] });
		await updateEvent(prisma, TEST_USER_ID, ID, { allDay: false, endsAt: timed.endsAt, startsAt: timed.startsAt });
		expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({ data: { allDay: false, endsAt: timed.endsAt, startsAt: timed.startsAt }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('moves only the end date of an all-day event keeping the stored start', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(allDay);
		await updateEvent(prisma, TEST_USER_ID, ID, { endDate: '2026-11-05' });
		expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({
			data: { endsAt: new Date('2026-11-06T00:00:00Z') },
			where: { id: ID, ownerId: TEST_USER_ID },
		});
	});

	it('throws 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(null);
		expect(await rejection(updateEvent(prisma, OTHER_USER_ID, ID, { title: 'x' }))).toMatchObject({ status: 404 });
	});
});

describe('deleteEvent', () => {
	it('deletes scoped by owner and throws 404 when nothing matches', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.calendarEvent.deleteMany).mockResolvedValue({ count: 1 });
		await deleteEvent(prisma, TEST_USER_ID, ID);
		expect(prisma.calendarEvent.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });

		vi.mocked(prisma.calendarEvent.deleteMany).mockResolvedValue({ count: 0 });
		expect(await rejection(deleteEvent(prisma, OTHER_USER_ID, ID))).toMatchObject({ status: 404 });
	});
});
