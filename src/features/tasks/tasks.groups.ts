import type { Prisma, PrismaClient, TaskPriority, TaskStatus } from '@usegonche/database';
import { scoped } from '../../lib/owner.js';
import type { PageParams } from '../../lib/pagination.js';

/** What the list can group by. `none` is the plain list. */
export const taskGroupings = ['none', 'project', 'goal', 'due', 'priority'] as const;
export type TaskGrouping = (typeof taskGroupings)[number];

export const OPEN: TaskStatus[] = ['todo', 'in_progress'];
export const CLOSED: TaskStatus[] = ['done', 'cancelled'];

const DAY_MS = 86_400_000;

/** Days (today included) that count as "this week", and how long a task closed recently stays in the working set. */
export const WEEK_DAYS = 7;

/**
 * Today's date as the tasks see it. The ONE place the day boundary is decided: the due buckets, the `overdue` counter and the working set all read it,
 * so they never disagree. It is the UTC date until the user's stored time zone replaces it here.
 */
export const taskToday = (now: Date): Date => new Date(now.toISOString().slice(0, 10));

/** Last due date (inclusive) of the "this week" bucket. */
export const weekEnd = (today: Date): Date => new Date(today.getTime() + (WEEK_DAYS - 1) * DAY_MS);

/** Due buckets, in the order the list shows them. */
export const dueBuckets = ['overdue', 'today', 'week', 'later', 'none'] as const;
export type DueBucket = (typeof dueBuckets)[number];

/**
 * Which tasks fall in a due bucket. `overdue` is for open tasks only: a finished task that was due in the past is simply `later`.
 * `today` and `week` hold tasks of any status.
 */
export const dueBucketWhere = (bucket: DueBucket, today: Date): Prisma.TaskWhereInput => {
	const end = weekEnd(today);
	if (bucket === 'overdue') return { dueDate: { lt: today }, status: { in: OPEN } };
	if (bucket === 'today') return { dueDate: today };
	if (bucket === 'week') return { dueDate: { gt: today, lte: end } };
	if (bucket === 'later') return { OR: [{ dueDate: { gt: end } }, { dueDate: { lt: today }, status: { in: CLOSED } }] };
	return { dueDate: null };
};

/** One group of the list: its key (`overdue`, `urgent`, a project id, `none`...) and how many tasks of the whole filtered set belong to it. */
export type TaskGroupPage = { count: number; key: string; taskIds: string[] };

type GroupPlan = { count: number; key: string; where: Prisma.TaskWhereInput };

const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

/** Groups with their size over the WHOLE filtered set (`where`), in display order, empty ones left out. */
export const planGroups = async (prisma: PrismaClient, ownerId: string, where: Prisma.TaskWhereInput, groupBy: Exclude<TaskGrouping, 'none'>, today: Date): Promise<GroupPlan[]> => {
	if (groupBy === 'due') {
		const counts = await Promise.all(dueBuckets.map(bucket => prisma.task.count({ where: { AND: [where, dueBucketWhere(bucket, today)] } })));
		return dueBuckets.flatMap((bucket, index) => ((counts[index] ?? 0) > 0 ? [{ count: counts[index] ?? 0, key: bucket, where: dueBucketWhere(bucket, today) }] : []));
	}
	if (groupBy === 'priority') {
		const grouped = await prisma.task.groupBy({ _count: { _all: true }, by: ['priority'], where });
		return PRIORITY_ORDER.flatMap(priority => {
			const count = grouped.find(group => group.priority === priority)?._count._all ?? 0;
			return count > 0 ? [{ count, key: priority, where: { priority } }] : [];
		});
	}
	// Projects and goals: by name, with the tasks that have none last.
	const field = groupBy === 'project' ? 'projectId' : 'goalId';
	const grouped = await prisma.task.groupBy({ _count: { _all: true }, by: [field], where });
	const ids = grouped.flatMap(group => (group[field] ? [group[field] as string] : []));
	const lookup = { select: { id: true, title: true }, where: scoped(ownerId, { id: { in: ids } }) };
	const named: { id: string; title: string }[] = ids.length === 0 ? [] : groupBy === 'project' ? await prisma.project.findMany(lookup) : await prisma.goal.findMany(lookup);
	const title = new Map(named.map(item => [item.id, item.title]));
	return grouped
		.map(group => ({ count: group._count._all, id: group[field] as string | null }))
		.sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : (title.get(a.id) ?? '').localeCompare(title.get(b.id) ?? '') || a.id.localeCompare(b.id)))
		.map(group => ({ count: group.count, key: group.id ?? 'none', where: { [field]: group.id } }));
};

/** For a page of the grouped list: which groups it touches and which rows (`skip`, `take`) of each. Groups are laid end to end, so a group can continue on the next page. */
export const sliceGroups = (plan: readonly GroupPlan[], { page, pageSize }: PageParams): (GroupPlan & { skip: number; take: number })[] => {
	const from = (page - 1) * pageSize;
	const to = from + pageSize;
	let start = 0;
	const slices: (GroupPlan & { skip: number; take: number })[] = [];
	for (const group of plan) {
		const end = start + group.count;
		if (end > from && start < to) slices.push({ ...group, skip: Math.max(from - start, 0), take: Math.min(end, to) - Math.max(start, from) });
		start = end;
	}
	return slices;
};
