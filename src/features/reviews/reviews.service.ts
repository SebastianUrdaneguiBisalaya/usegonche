import type { Prisma, PrismaClient, Review, ReviewDecision } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Cursor, keysetAfter, keysetOrder } from '../../lib/pagination.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import { addDays, isoWeekday } from '../../lib/time.js';
import { computePrefill, type Prefill } from './reviews.prefill.js';
import type { CloseReviewInput, ListReviewsFilters, OpenReviewInput, UpdateReviewInput } from './reviews.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** A review with its decisions. `prefill` is live data and only present while the review is open; a closed one keeps its snapshot counters. */
export type ReviewView = Review & { decisions: ReviewDecision[]; prefill: Prefill | null };

/** The local dates the review covers: the day itself, or the Monday..Sunday week that contains it. */
export const periodOf = (kind: 'daily' | 'weekly', date: string): { end: string; start: string } => {
	if (kind === 'daily') return { end: date, start: date };
	const start = addDays(date, -(isoWeekday(date) - 1));
	return { end: addDays(start, 6), start };
};

const toDate = (value: Date): string => value.toISOString().slice(0, 10);

const findOwned = async (prisma: Db, ownerId: string, id: string): Promise<Review & { decisions: ReviewDecision[] }> => {
	const review = await prisma.review.findFirst({ include: { decisions: { orderBy: [{ decidedAt: 'asc' }, { id: 'asc' }] } }, where: scoped(ownerId, { id }) });
	if (!review) throw new AppError('not_found', 404);
	return review;
};

export const getReview = async (prisma: Db, ownerId: string, id: string): Promise<ReviewView> => {
	const review = await findOwned(prisma, ownerId, id);
	return { ...review, prefill: review.status === 'open' ? await computePrefill(prisma, ownerId, toDate(review.periodStart), toDate(review.periodEnd)) : null };
};

/** Fetches `limit + 1` reviews after `cursor` (most recent period first); pass them to `toPage`. */
export const listReviews = (prisma: PrismaClient, ownerId: string, filters: ListReviewsFilters, limit: number, cursor?: Cursor): Promise<Review[]> =>
	prisma.review.findMany({
		orderBy: keysetOrder('periodStart'),
		take: limit + 1,
		where: { ...scoped(ownerId, { ...(filters.kind && { kind: filters.kind }), ...(filters.status && { status: filters.status }) }), ...keysetAfter('periodStart', cursor) },
	});

/**
 * Opens the review of a period. Idempotent: if it already exists (open or closed) it is returned instead of duplicated.
 * `created` tells the route which status to answer (201 vs 200).
 */
export const openReview = async (prisma: PrismaClient, ownerId: string, input: OpenReviewInput): Promise<{ created: boolean; review: ReviewView }> => {
	const { end, start } = periodOf(input.kind, input.date);
	const where = scoped(ownerId, { kind: input.kind, periodStart: new Date(start) });
	const existing = await prisma.review.findFirst({ select: { id: true }, where });
	if (existing) return { created: false, review: await getReview(prisma, ownerId, existing.id) };
	try {
		const { id } = await prisma.review.create({ data: { kind: input.kind, ownerId, periodEnd: new Date(end), periodStart: new Date(start) }, select: { id: true } });
		return { created: true, review: await getReview(prisma, ownerId, id) };
	} catch (error) {
		if (!isUniqueViolation(error)) throw error;
		const raced = await prisma.review.findFirst({ select: { id: true }, where });
		if (!raced) throw error;
		return { created: false, review: await getReview(prisma, ownerId, raced.id) };
	}
};

export const updateReview = async (prisma: PrismaClient, ownerId: string, id: string, input: UpdateReviewInput): Promise<ReviewView> => {
	const { count } = await prisma.review.updateMany({ data: input, where: scoped(ownerId, { id, status: 'open' as const }) });
	if (count === 0) {
		await findOwned(prisma, ownerId, id);
		throw new AppError('invalid_state', 409);
	}
	return getReview(prisma, ownerId, id);
};

/**
 * Closes the review: the live figures are snapshotted into the typed counters and the review stops changing.
 * Optionally sets the final reflection / next focus. 409 if it was already closed. Pending tasks do not need a decision.
 */
export const closeReview = (prisma: PrismaClient, ownerId: string, id: string, input: CloseReviewInput): Promise<ReviewView> =>
	prisma.$transaction(async tx => {
		const review = await findOwned(tx, ownerId, id);
		if (review.status !== 'open') throw new AppError('invalid_state', 409);
		const { counters } = await computePrefill(tx, ownerId, toDate(review.periodStart), toDate(review.periodEnd));
		await tx.review.updateMany({
			data: {
				...counters,
				closedAt: new Date(),
				status: 'closed',
				...(input.nextFocus !== undefined && { nextFocus: input.nextFocus }),
				...(input.reflection !== undefined && { reflection: input.reflection }),
			},
			where: scoped(ownerId, { id, status: 'open' as const }),
		});
		return getReview(tx, ownerId, id);
	});
