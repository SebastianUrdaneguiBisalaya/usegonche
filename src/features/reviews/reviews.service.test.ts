import type { Review } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { closeReview, getReview, listReviews, openReview, periodOf, updateReview } from './reviews.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const review = (extra: object = {}) =>
	({ decisions: [], id: ID, kind: 'daily', ownerId: TEST_USER_ID, periodEnd: new Date('2026-11-02'), periodStart: new Date('2026-11-02'), status: 'open', ...extra }) as unknown as Review & {
		decisions: [];
	};

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

/** Empty data for the prefill queries. */
const withEmptyPrefill = (prisma: ReturnType<typeof createMockPrisma>) => {
	vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue([]);
	vi.mocked(prisma.task.findMany).mockResolvedValue([]);
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValue([]);
	vi.mocked(prisma.taskBlocker.findMany).mockResolvedValue([]);
	vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([]);
	return prisma;
};

describe('periodOf', () => {
	it('daily is the day itself', () => {
		expect(periodOf('daily', '2026-11-04')).toEqual({ end: '2026-11-04', start: '2026-11-04' });
	});

	it.each(['2026-11-02', '2026-11-04', '2026-11-08'])('weekly is the Monday..Sunday week containing %s', date => {
		expect(periodOf('weekly', date)).toEqual({ end: '2026-11-08', start: '2026-11-02' });
	});

	it('weekly crosses months and years', () => {
		expect(periodOf('weekly', '2027-01-01')).toEqual({ end: '2027-01-03', start: '2026-12-28' });
	});
});

describe('getReview', () => {
	it('adds live prefill to an open review', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review()));
		const result = await getReview(prisma, TEST_USER_ID, ID);
		expect(result.prefill?.counters).toEqual({ actualMinutes: 0, completedTasks: 0, plannedMinutes: 0, plannedTasks: 0 });
		expect(prisma.review.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID, ownerId: TEST_USER_ID } }));
	});

	it('does not recompute a closed review (its snapshot is the truth)', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review({ status: 'closed' })));
		expect((await getReview(prisma, TEST_USER_ID, ID)).prefill).toBeNull();
		expect(prisma.dailyPlanItem.findMany).not.toHaveBeenCalled();
	});

	it('throws 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
		expect(await rejection(getReview(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('listReviews', () => {
	it('lists reviews by period, newest first, with filters and owner scope', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.review.findMany).mockResolvedValue([]);
		await listReviews(prisma, TEST_USER_ID, { kind: 'weekly', status: 'closed' }, 20);
		expect(prisma.review.findMany).toHaveBeenCalledWith({ orderBy: [{ periodStart: 'desc' }, { id: 'desc' }], take: 21, where: { kind: 'weekly', ownerId: TEST_USER_ID, status: 'closed' } });
	});
});

describe('openReview', () => {
	it('creates the review of a weekly period', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.findFirst)
			.mockResolvedValueOnce(null)
			.mockResolvedValue(asRow(review({ kind: 'weekly' })));
		vi.mocked(prisma.review.create).mockResolvedValue(asRow({ id: ID }));
		const result = await openReview(prisma, TEST_USER_ID, { date: '2026-11-04', kind: 'weekly' });
		expect(result.created).toBe(true);
		expect(prisma.review.create).toHaveBeenCalledWith({
			data: { kind: 'weekly', ownerId: TEST_USER_ID, periodEnd: new Date('2026-11-08'), periodStart: new Date('2026-11-02') },
			select: { id: true },
		});
	});

	it('returns the existing review instead of duplicating it', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review()));
		const result = await openReview(prisma, TEST_USER_ID, { date: '2026-11-02', kind: 'daily' });
		expect(result.created).toBe(false);
		expect(prisma.review.create).not.toHaveBeenCalled();
		expect(vi.mocked(prisma.review.findFirst).mock.calls[0]?.[0]?.where).toEqual({ kind: 'daily', ownerId: TEST_USER_ID, periodStart: new Date('2026-11-02') });
	});

	it('survives a creation race by returning the winner', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.findFirst).mockResolvedValueOnce(null).mockResolvedValue(asRow(review()));
		vi.mocked(prisma.review.create).mockRejectedValue({ code: 'P2002' });
		expect((await openReview(prisma, TEST_USER_ID, { date: '2026-11-02', kind: 'daily' })).created).toBe(false);
	});

	it('rethrows unexpected errors', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.review.create).mockRejectedValue(new Error('boom'));
		expect(await rejection(openReview(prisma, TEST_USER_ID, { date: '2026-11-02', kind: 'daily' }))).toMatchObject({ message: 'boom' });
	});
});

describe('updateReview', () => {
	it('updates an open review scoped by owner', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review()));
		await updateReview(prisma, TEST_USER_ID, ID, { reflection: 'Good day' });
		expect(prisma.review.updateMany).toHaveBeenCalledWith({ data: { reflection: 'Good day' }, where: { id: ID, ownerId: TEST_USER_ID, status: 'open' } });
	});

	it('is idempotent: the same values write nothing, null over an empty value too', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review({ reflection: 'Good day' })));
		await updateReview(prisma, TEST_USER_ID, ID, { nextFocus: null, reflection: 'Good day' });
		expect(prisma.review.updateMany).not.toHaveBeenCalled();
	});

	it('answers 409 when a race closes the review between the read and the write', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review()));
		vi.mocked(prisma.review.updateMany).mockResolvedValue({ count: 0 });
		expect(await rejection(updateReview(prisma, TEST_USER_ID, ID, { reflection: 'x' }))).toMatchObject({ code: 'invalid_state', status: 409 });
	});

	it('answers 409 for a closed review even when nothing would change, and 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review({ reflection: 'x', status: 'closed' })));
		expect(await rejection(updateReview(prisma, TEST_USER_ID, ID, { reflection: 'x' }))).toMatchObject({ code: 'invalid_state', status: 409 });

		vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
		expect(await rejection(updateReview(prisma, OTHER_USER_ID, ID, { reflection: 'x' }))).toMatchObject({ status: 404 });
	});
});

describe('closeReview', () => {
	it('snapshots the live counters, closes the review and keeps the texts', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue(asRow([{ task: { dueDate: null, id: 't1', priority: 'low', status: 'todo', title: 't1' } }]));
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review()));
		await closeReview(prisma, TEST_USER_ID, ID, { nextFocus: 'Ship it', reflection: 'Slow day' });
		expect(prisma.review.updateMany).toHaveBeenCalledWith({
			data: { actualMinutes: 0, closedAt: expect.any(Date), completedTasks: 0, nextFocus: 'Ship it', plannedMinutes: 0, plannedTasks: 1, reflection: 'Slow day', status: 'closed' },
			where: { id: ID, ownerId: TEST_USER_ID, status: 'open' },
		});
	});

	it('leaves the texts untouched when they are not sent', async () => {
		const prisma = withEmptyPrefill(createMockPrisma());
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review()));
		await closeReview(prisma, TEST_USER_ID, ID, {});
		const data = vi.mocked(prisma.review.updateMany).mock.calls[0]?.[0]?.data as Record<string, unknown>;
		expect(data).not.toHaveProperty('reflection');
		expect(data).not.toHaveProperty('nextFocus');
	});

	it('answers 409 when already closed and 404 for another owner, closing nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review({ status: 'closed' })));
		expect(await rejection(closeReview(prisma, TEST_USER_ID, ID, {}))).toMatchObject({ code: 'invalid_state', status: 409 });

		vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
		expect(await rejection(closeReview(prisma, OTHER_USER_ID, ID, {}))).toMatchObject({ status: 404 });
		expect(prisma.review.updateMany).not.toHaveBeenCalled();
	});
});
