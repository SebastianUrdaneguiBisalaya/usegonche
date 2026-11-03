import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import {
	claimReminder,
	createReminder,
	deleteReminder,
	dismissReminder,
	findDueReminders,
	getReminder,
	listReminders,
	processDueReminders,
	snoozeReminder,
	updateReminder,
} from './reminders.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TARGET_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const NOW = new Date('2026-11-02T10:00:00Z');
const LATER = new Date('2026-11-02T12:00:00Z');
const row = (extra: object = {}) => ({ id: ID, ownerId: TEST_USER_ID, remindAt: NOW, sentAt: null, snoozeCount: 0, status: 'pending', taskId: TARGET_ID, ...extra });

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('createReminder', () => {
	it.each([
		['task', 'task', { taskId: TARGET_ID }, { taskId: TARGET_ID }],
		['calendarEvent', 'event', { eventId: TARGET_ID }, { calendarEventId: TARGET_ID }],
		['note', 'note', { noteId: TARGET_ID }, { noteId: TARGET_ID }],
	] as const)('attaches the reminder to a %s of the owner', async (model, _name, input, expected) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma[model].findFirst).mockResolvedValue(asRow({ id: TARGET_ID }));
		vi.mocked(prisma.reminder.create).mockResolvedValue(asRow(row()));
		await createReminder(prisma, TEST_USER_ID, { remindAt: LATER, ...input });
		expect(prisma[model].findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TARGET_ID, ownerId: TEST_USER_ID } }));
		expect(prisma.reminder.create).toHaveBeenCalledWith({ data: { ownerId: TEST_USER_ID, remindAt: LATER, ...expected } });
	});

	it.each([
		['task', { taskId: TARGET_ID }, 'taskId'],
		['calendarEvent', { eventId: TARGET_ID }, 'eventId'],
		['note', { noteId: TARGET_ID }, 'noteId'],
	] as const)("rejects a %s that is not the owner's with 422", async (model, input, field) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma[model].findFirst).mockResolvedValue(null);
		expect(await rejection(createReminder(prisma, OTHER_USER_ID, { remindAt: LATER, ...input }))).toMatchObject({ code: 'validation_error', details: [{ code: 'not_found', field }], status: 422 });
		expect(prisma.reminder.create).not.toHaveBeenCalled();
	});
});

describe('listReminders', () => {
	it('scopes by owner, applies the filters and returns one page', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue([]);
		vi.mocked(prisma.reminder.count).mockResolvedValue(0);
		expect(await listReminders(prisma, TEST_USER_ID, { eventId: TARGET_ID, status: 'sent' }, { page: 1, pageSize: 20 })).toEqual({ items: [], total: 0 });
		expect(prisma.reminder.findMany).toHaveBeenCalledWith({
			orderBy: [{ remindAt: 'desc' }, { id: 'desc' }],
			skip: 0,
			take: 20,
			where: { calendarEventId: TARGET_ID, noteId: undefined, ownerId: TEST_USER_ID, status: 'sent', taskId: undefined },
		});
	});

	it('skips the previous pages', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue([]);
		await listReminders(prisma, TEST_USER_ID, {}, { page: 2, pageSize: 10 });
		expect(vi.mocked(prisma.reminder.findMany).mock.calls[0]?.[0]).toMatchObject({ skip: 10, take: 10 });
	});
});

describe('getReminder / deleteReminder', () => {
	it('returns the reminder scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row()));
		await getReminder(prisma, TEST_USER_ID, ID);
		expect(prisma.reminder.findFirst).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('answers 404 for a reminder of another user', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(null);
		expect(await rejection(getReminder(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('deletes scoped by owner and answers 404 when nothing matched', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.deleteMany).mockResolvedValue({ count: 0 });
		expect(await rejection(deleteReminder(prisma, TEST_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.reminder.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
	});
});

describe('updateReminder', () => {
	it('reschedules a pending reminder with a conditional update', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row()));
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
		await updateReminder(prisma, TEST_USER_ID, ID, { remindAt: LATER });
		expect(prisma.reminder.updateMany).toHaveBeenCalledWith({ data: { remindAt: LATER }, where: { id: ID, ownerId: TEST_USER_ID, status: 'pending' } });
	});

	it.each(['sent', 'dismissed'])('answers 409 for a %s reminder', async status => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row({ status })));
		expect(await rejection(updateReminder(prisma, TEST_USER_ID, ID, { remindAt: LATER }))).toMatchObject({ code: 'invalid_state', status: 409 });
		expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
	});

	it('answers 409 when the processor claimed it in between', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row()));
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 0 });
		expect(await rejection(updateReminder(prisma, TEST_USER_ID, ID, { remindAt: LATER }))).toMatchObject({ code: 'invalid_state', status: 409 });
	});
});

describe('snoozeReminder', () => {
	it('moves a pending or sent reminder forward and returns it to pending', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row({ remindAt: LATER, snoozeCount: 1 })));
		await snoozeReminder(prisma, TEST_USER_ID, ID, { remindAt: LATER });
		expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
			data: { dismissedAt: null, remindAt: LATER, sentAt: null, snoozeCount: { increment: 1 }, status: 'pending' },
			where: { id: ID, ownerId: TEST_USER_ID, status: { in: ['pending', 'sent'] } },
		});
	});

	it("answers 409 for a dismissed reminder and 404 for one that is not the owner's", async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row({ status: 'dismissed' })));
		expect(await rejection(snoozeReminder(prisma, TEST_USER_ID, ID, { remindAt: LATER }))).toMatchObject({ code: 'invalid_state', status: 409 });
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(null);
		expect(await rejection(snoozeReminder(prisma, OTHER_USER_ID, ID, { remindAt: LATER }))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('dismissReminder', () => {
	it('dismisses a pending or sent reminder scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(asRow(row({ status: 'dismissed' })));
		await dismissReminder(prisma, TEST_USER_ID, ID, NOW);
		expect(prisma.reminder.updateMany).toHaveBeenCalledWith({ data: { dismissedAt: NOW, status: 'dismissed' }, where: { id: ID, ownerId: TEST_USER_ID, status: { in: ['pending', 'sent'] } } });
	});

	it("answers 404 when the reminder is not the owner's", async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.reminder.findFirst).mockResolvedValue(null);
		expect(await rejection(dismissReminder(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('findDueReminders / claimReminder', () => {
	it('selects pending reminders already due, oldest first, bounded', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue([]);
		await findDueReminders(prisma, NOW);
		expect(prisma.reminder.findMany).toHaveBeenCalledWith({ orderBy: [{ remindAt: 'asc' }, { id: 'asc' }], take: 100, where: { remindAt: { lte: NOW }, status: 'pending' } });
	});

	it('claims with one conditional pending -> sent update and tells whether it won', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.updateMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
		expect(await claimReminder(prisma, ID, NOW)).toBe(true);
		expect(await claimReminder(prisma, ID, NOW)).toBe(false);
		expect(prisma.reminder.updateMany).toHaveBeenCalledWith({ data: { sentAt: NOW, status: 'sent' }, where: { id: ID, remindAt: { lte: NOW }, status: 'pending' } });
	});
});

describe('processDueReminders', () => {
	it('just marks due reminders as sent when no delivery hook is given (internal reminders)', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue(asRow([row()]));
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
		expect(await processDueReminders(prisma, undefined, NOW)).toEqual({ claimed: 1, failed: 0 });
	});

	it('delivers each claimed reminder once', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue(asRow([row(), row({ id: 'r2' })]));
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
		const deliver = vi.fn().mockResolvedValue(undefined);
		expect(await processDueReminders(prisma, deliver, NOW)).toEqual({ claimed: 2, failed: 0 });
		expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ id: ID, sentAt: NOW, status: 'sent' }));
	});

	it('is idempotent: a reminder claimed by an overlapping run is skipped', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue(asRow([row()]));
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 0 });
		const deliver = vi.fn();
		expect(await processDueReminders(prisma, deliver, NOW)).toEqual({ claimed: 0, failed: 0 });
		expect(deliver).not.toHaveBeenCalled();
	});

	it('puts a reminder back to pending when delivery fails, and keeps going', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.reminder.findMany).mockResolvedValue(asRow([row(), row({ id: 'r2' })]));
		vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
		const deliver = vi.fn().mockRejectedValueOnce(new Error('push down')).mockResolvedValueOnce(undefined);
		expect(await processDueReminders(prisma, deliver, NOW)).toEqual({ claimed: 1, failed: 1 });
		expect(prisma.reminder.updateMany).toHaveBeenCalledWith({ data: { sentAt: null, status: 'pending' }, where: { id: ID, sentAt: NOW, status: 'sent' } });
	});
});
