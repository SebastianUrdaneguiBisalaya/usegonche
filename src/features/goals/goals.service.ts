import type { Goal, GoalStatus, PrismaClient } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';
import type { CreateGoalInput, UpdateGoalInput } from './goals.schemas.js';

/** One page of goals (newest first) with the total. Archived goals are hidden unless asked for. */
export const listGoals = async (prisma: PrismaClient, ownerId: string, filters: { archived: boolean; status?: GoalStatus }, page: PageParams): Promise<Paged<Goal>> => {
	const where = scoped(ownerId, { archivedAt: filters.archived ? { not: null } : null, ...(filters.status && { status: filters.status }) });
	const [items, total] = await Promise.all([prisma.goal.findMany({ orderBy: pageOrder('createdAt'), ...pageArgs(page), where }), prisma.goal.count({ where })]);
	return { items, total };
};

export const getGoal = async (prisma: PrismaClient, ownerId: string, id: string): Promise<Goal> => {
	const goal = await prisma.goal.findFirst({ where: scoped(ownerId, { id }) });
	if (!goal) throw new AppError('not_found', 404);
	return goal;
};

export const createGoal = (prisma: PrismaClient, ownerId: string, input: CreateGoalInput): Promise<Goal> =>
	prisma.goal.create({ data: { description: input.description, ownerId, targetDate: input.targetDate, title: input.title } });

/** Writes only what changed; an update that changes nothing answers with the current goal and writes nothing. */
export const updateGoal = async (prisma: PrismaClient, ownerId: string, id: string, input: UpdateGoalInput): Promise<Goal> => {
	const current = await getGoal(prisma, ownerId, id);
	const changed = changedFields(current, input);
	if (!hasChanges(changed)) return current;
	await prisma.goal.updateMany({ data: changed, where: scoped(ownerId, { id }) });
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
