import type { Goal, GoalStatus, PrismaClient } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Cursor, keysetAfter, keysetOrder } from '../../lib/pagination.js';
import type { CreateGoalInput, UpdateGoalInput } from './goals.schemas.js';

/** Fetches `limit + 1` rows after `cursor` (newest first); pass them to `toPage`. Archived goals are hidden unless asked for. */
export const listGoals = (prisma: PrismaClient, ownerId: string, filters: { archived: boolean; status?: GoalStatus }, limit: number, cursor?: Cursor): Promise<Goal[]> =>
	prisma.goal.findMany({
		orderBy: keysetOrder('createdAt'),
		take: limit + 1,
		where: { ...scoped(ownerId, { archivedAt: filters.archived ? { not: null } : null, ...(filters.status && { status: filters.status }) }), ...keysetAfter('createdAt', cursor) },
	});

export const getGoal = async (prisma: PrismaClient, ownerId: string, id: string): Promise<Goal> => {
	const goal = await prisma.goal.findFirst({ where: scoped(ownerId, { id }) });
	if (!goal) throw new AppError('not_found', 404);
	return goal;
};

export const createGoal = (prisma: PrismaClient, ownerId: string, input: CreateGoalInput): Promise<Goal> =>
	prisma.goal.create({ data: { description: input.description, ownerId, targetDate: input.targetDate, title: input.title } });

export const updateGoal = async (prisma: PrismaClient, ownerId: string, id: string, input: UpdateGoalInput): Promise<Goal> => {
	const { count } = await prisma.goal.updateMany({ data: input, where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
	return getGoal(prisma, ownerId, id);
};

/** Idempotent: archiving an archived goal keeps the original `archivedAt`. Its projects are untouched. */
export const archiveGoal = async (prisma: PrismaClient, ownerId: string, id: string): Promise<Goal> => {
	await prisma.goal.updateMany({ data: { archivedAt: new Date() }, where: scoped(ownerId, { archivedAt: null, id }) });
	return getGoal(prisma, ownerId, id);
};

export const unarchiveGoal = async (prisma: PrismaClient, ownerId: string, id: string): Promise<Goal> => {
	await prisma.goal.updateMany({ data: { archivedAt: null }, where: scoped(ownerId, { archivedAt: { not: null }, id }) });
	return getGoal(prisma, ownerId, id);
};
