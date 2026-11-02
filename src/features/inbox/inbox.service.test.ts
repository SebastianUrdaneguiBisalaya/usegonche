import type { InboxItem } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { brainDump, captureItem, listItems, markConverted, setStatus } from './inbox.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const item = { content: 'call mom', id: ID, ownerId: TEST_USER_ID, source: 'quick', status: 'pending' } as InboxItem;

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('captureItem', () => {
	it('creates a quick pending item for the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.create).mockResolvedValue(item);

		expect(await captureItem(prisma, TEST_USER_ID, 'call mom')).toBe(item);
		expect(prisma.inboxItem.create).toHaveBeenCalledWith({ data: { content: 'call mom', ownerId: TEST_USER_ID, source: 'quick' } });
	});
});

describe('brainDump', () => {
	it('creates one braindump item per line in a single write', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.createManyAndReturn).mockResolvedValue([item]);

		await brainDump(prisma, TEST_USER_ID, ['a', 'b']);
		expect(prisma.inboxItem.createManyAndReturn).toHaveBeenCalledWith({
			data: [
				{ content: 'a', ownerId: TEST_USER_ID, source: 'braindump' },
				{ content: 'b', ownerId: TEST_USER_ID, source: 'braindump' },
			],
		});
	});
});

describe('listItems', () => {
	const NOW = new Date('2026-11-02T12:00:00.000Z');
	const FIRST = { page: 1, pageSize: 20 };

	it('returns a page of owner items of a status, newest first, with the counts of every status', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([item]);
		vi.mocked(prisma.inboxItem.groupBy).mockResolvedValue([
			{ _count: { _all: 3 }, status: 'archived' },
			{ _count: { _all: 12 }, status: 'pending' },
		] as never);

		const page = await listItems(prisma, TEST_USER_ID, 'archived', 'all', FIRST, NOW);
		expect(page).toEqual({ counts: { archived: 3, converted: 0, discarded: 0, pending: 12 }, items: [item], total: 3 });
		expect(prisma.inboxItem.findMany).toHaveBeenCalledWith({ orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20, where: { ownerId: TEST_USER_ID, status: 'archived' } });
		expect(prisma.inboxItem.groupBy).toHaveBeenCalledWith({ _count: { _all: true }, by: ['status'], where: { ownerId: TEST_USER_ID } });
	});

	it('zeroes the counts and the total when the owner has no items', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([]);
		vi.mocked(prisma.inboxItem.groupBy).mockResolvedValue([] as never);

		expect(await listItems(prisma, TEST_USER_ID, 'pending', 'all', FIRST, NOW)).toEqual({ counts: { archived: 0, converted: 0, discarded: 0, pending: 0 }, items: [], total: 0 });
	});

	it('skips the previous pages without dropping the owner scope', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([]);
		vi.mocked(prisma.inboxItem.groupBy).mockResolvedValue([] as never);

		await listItems(prisma, TEST_USER_ID, 'pending', 'all', { page: 3, pageSize: 10 }, NOW);
		expect(vi.mocked(prisma.inboxItem.findMany).mock.calls[0]?.[0]).toMatchObject({ skip: 20, take: 10, where: { ownerId: TEST_USER_ID, status: 'pending' } });
	});

	it.each([
		['24h', 24],
		['7d', 168],
		['30d', 720],
	] as const)('limits the list and the counts to the last %s', async (range, hours) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.findMany).mockResolvedValue([]);
		vi.mocked(prisma.inboxItem.groupBy).mockResolvedValue([] as never);
		const gte = new Date(NOW.getTime() - hours * 3_600_000);

		await listItems(prisma, TEST_USER_ID, 'pending', range, FIRST, NOW);
		expect(vi.mocked(prisma.inboxItem.findMany).mock.calls[0]?.[0]?.where).toEqual({ capturedAt: { gte }, ownerId: TEST_USER_ID, status: 'pending' });
		expect(vi.mocked(prisma.inboxItem.groupBy).mock.calls[0]?.[0]?.where).toEqual({ capturedAt: { gte }, ownerId: TEST_USER_ID });
	});
});

describe('setStatus', () => {
	it('archives a non-converted item and stamps processedAt', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue({ ...item, status: 'archived' });

		expect(await setStatus(prisma, TEST_USER_ID, ID, 'archived')).toMatchObject({ status: 'archived' });
		const args = vi.mocked(prisma.inboxItem.updateMany).mock.calls[0]?.[0];
		expect(args?.where).toEqual({ id: ID, ownerId: TEST_USER_ID, status: { not: 'converted' } });
		expect(args?.data).toMatchObject({ status: 'archived', processedAt: expect.any(Date) });
	});

	it('clears processedAt when restoring to pending', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(item);

		await setStatus(prisma, TEST_USER_ID, ID, 'pending');
		expect(vi.mocked(prisma.inboxItem.updateMany).mock.calls[0]?.[0].data).toEqual({ processedAt: null, status: 'pending' });
	});

	it('answers invalid_state (409) for a converted item', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue({ id: ID } as InboxItem);

		expect(await rejection(setStatus(prisma, TEST_USER_ID, ID, 'discarded'))).toMatchObject({ code: 'invalid_state', status: 409 });
	});

	it('answers not_found (404) for an item of another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(null);

		expect(await rejection(setStatus(prisma, OTHER_USER_ID, ID, 'archived'))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.inboxItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerId: OTHER_USER_ID }) }));
	});
});

describe('markConverted', () => {
	it('converts only pending items of the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });

		await markConverted(prisma, TEST_USER_ID, ID);
		const args = vi.mocked(prisma.inboxItem.updateMany).mock.calls[0]?.[0];
		expect(args?.where).toEqual({ id: ID, ownerId: TEST_USER_ID, status: 'pending' });
		expect(args?.data).toMatchObject({ status: 'converted', processedAt: expect.any(Date) });
	});

	it('answers invalid_state (409) when it is not pending any more', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue({ id: ID } as InboxItem);
		expect(await rejection(markConverted(prisma, TEST_USER_ID, ID))).toMatchObject({ code: 'invalid_state', status: 409 });
	});

	it('answers not_found (404) for an unknown item', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(null);
		expect(await rejection(markConverted(prisma, TEST_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
