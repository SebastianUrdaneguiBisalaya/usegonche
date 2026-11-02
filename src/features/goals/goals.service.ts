import type { Goal, GoalStatus, PrismaClient } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type PageParams, pageArgs } from '../../lib/pagination.js';
import type { CreateGoalInput, goalDueFilters, goalSortFields, UpdateGoalInput } from './goals.schemas.js';
import { SOON_DAYS } from './goals.schemas.js';

type GoalSort = (typeof goalSortFields)[number];
type GoalDue = (typeof goalDueFilters)[number];

/** Progress of a goal: tasks that count (cancelled ones do not) and how many of them are done. */
export type TaskCounts = { done: number; total: number };
export type GoalWithStats = Goal & { projectCount: number; taskCounts: TaskCounts };
export type GoalListFilters = { archived: boolean; due?: GoalDue; order?: 'asc' | 'desc'; sort?: GoalSort; status?: GoalStatus };
/** Goals per tab: one counter per status (not archived) plus the archived ones. */
export type GoalCounts = Record<GoalStatus | 'archived', number>;
export type GoalPage = { counts: GoalCounts; items: GoalWithStats[]; total: number };

const DAY_MS = 86_400_000;
const startOfDay = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** The target-date range of a due filter. Only active goals can be overdue or due soon. */
const dueWhere = (due: GoalDue | undefined, now: Date) => {
	if (!due) return {};
	const today = startOfDay(now);
	const targetDate = due === 'overdue' ? { lt: today } : { gte: today, lte: new Date(today.getTime() + SOON_DAYS * DAY_MS) };
	return { status: 'active' as const, targetDate };
};

/**
 * Projects (not archived) and progress of each goal, from grouped queries. Tasks count when they are linked to the goal
 * directly, or belong to one of its projects without a goal of their own (so no task is counted twice).
 */
const attachStats = async (prisma: PrismaClient, ownerId: string, goals: Goal[]): Promise<GoalWithStats[]> => {
	if (goals.length === 0) return [];
	const goalIds = goals.map(goal => goal.id);
	const projects = await prisma.project.findMany({ select: { goalId: true, id: true }, where: scoped(ownerId, { archivedAt: null, goalId: { in: goalIds } }) });
	const goalOfProject = new Map(projects.map(project => [project.id, project.goalId]));
	const counting = { not: 'cancelled' as const };
	const [direct, viaProjects] = await Promise.all([
		prisma.task.groupBy({ _count: { _all: true }, by: ['goalId', 'status'], where: scoped(ownerId, { goalId: { in: goalIds }, status: counting }) }),
		projects.length === 0
			? []
			: prisma.task.groupBy({
					_count: { _all: true },
					by: ['projectId', 'status'],
					where: scoped(ownerId, { goalId: null, projectId: { in: projects.map(project => project.id) }, status: counting }),
				}),
	]);

	const tasks = new Map<string, TaskCounts>();
	const add = (goalId: string | null | undefined, status: string, count: number) => {
		if (!goalId) return;
		const current = tasks.get(goalId) ?? { done: 0, total: 0 };
		current.total += count;
		if (status === 'done') current.done += count;
		tasks.set(goalId, current);
	};
	for (const group of direct) add(group.goalId, group.status, group._count._all);
	for (const group of viaProjects) add(group.projectId && goalOfProject.get(group.projectId), group.status, group._count._all);

	const projectCounts = new Map<string, number>();
	for (const project of projects) if (project.goalId) projectCounts.set(project.goalId, (projectCounts.get(project.goalId) ?? 0) + 1);
	return goals.map(goal => ({ ...goal, projectCount: projectCounts.get(goal.id) ?? 0, taskCounts: tasks.get(goal.id) ?? { done: 0, total: 0 } }));
};

/**
 * One page of goals (archived ones only when asked for) with the counter of every tab. The counters follow the due filter but
 * not the status, so each tab shows how many goals it would hold. `total` is the count of the requested tab.
 * Goals without a target date go last when sorting by it.
 */
export const listGoals = async (prisma: PrismaClient, ownerId: string, filters: GoalListFilters, page: PageParams, now: Date = new Date()): Promise<GoalPage> => {
	const due = dueWhere(filters.due, now);
	const where = scoped(ownerId, { archivedAt: filters.archived ? { not: null } : null, ...due, ...(filters.status && { status: filters.status }) });
	const sort = filters.sort ?? 'createdAt';
	const order = filters.order ?? 'desc';
	const orderBy = [sort === 'targetDate' ? { targetDate: { nulls: 'last' as const, sort: order } } : ({ [sort]: order } as Record<Exclude<GoalSort, 'targetDate'>, 'asc' | 'desc'>), { id: order }];
	const [rows, total, grouped, archived] = await Promise.all([
		prisma.goal.findMany({ orderBy, ...pageArgs(page), where }),
		prisma.goal.count({ where }),
		prisma.goal.groupBy({ _count: { _all: true }, by: ['status'], where: scoped(ownerId, { archivedAt: null, ...due }) }),
		prisma.goal.count({ where: scoped(ownerId, { archivedAt: { not: null }, ...due }) }),
	]);
	const counts: GoalCounts = { achieved: 0, active: 0, archived };
	for (const group of grouped) counts[group.status] = group._count._all;
	return { counts, items: await attachStats(prisma, ownerId, rows), total };
};

export const getGoal = async (prisma: PrismaClient, ownerId: string, id: string): Promise<GoalWithStats> => {
	const goal = await prisma.goal.findFirst({ where: scoped(ownerId, { id }) });
	if (!goal) throw new AppError('not_found', 404);
	const [withStats] = await attachStats(prisma, ownerId, [goal]);
	return withStats as GoalWithStats;
};

export const createGoal = async (prisma: PrismaClient, ownerId: string, input: CreateGoalInput): Promise<GoalWithStats> => {
	const { id } = await prisma.goal.create({ data: { description: input.description, ownerId, targetDate: input.targetDate, title: input.title }, select: { id: true } });
	return getGoal(prisma, ownerId, id);
};

/** Writes only what changed; an update that changes nothing answers with the current goal and writes nothing. */
export const updateGoal = async (prisma: PrismaClient, ownerId: string, id: string, input: UpdateGoalInput): Promise<GoalWithStats> => {
	const current = await getGoal(prisma, ownerId, id);
	const changed = changedFields(current, input);
	if (!hasChanges(changed)) return current;
	await prisma.goal.updateMany({ data: changed, where: scoped(ownerId, { id }) });
	return getGoal(prisma, ownerId, id);
};

/** Idempotent: archiving an archived goal keeps the original `archivedAt`. Its projects are untouched. */
export const archiveGoal = async (prisma: PrismaClient, ownerId: string, id: string): Promise<GoalWithStats> => {
	await prisma.goal.updateMany({ data: { archivedAt: new Date() }, where: scoped(ownerId, { archivedAt: null, id }) });
	return getGoal(prisma, ownerId, id);
};

export const unarchiveGoal = async (prisma: PrismaClient, ownerId: string, id: string): Promise<GoalWithStats> => {
	await prisma.goal.updateMany({ data: { archivedAt: null }, where: scoped(ownerId, { archivedAt: { not: null }, id }) });
	return getGoal(prisma, ownerId, id);
};
