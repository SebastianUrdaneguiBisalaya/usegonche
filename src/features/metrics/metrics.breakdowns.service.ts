import type { TaskPriority, TaskStatus } from '@usegonche/database';
import { scoped } from '../../lib/owner.js';
import { isoWeekday, localDateOf, localHourOf } from '../../lib/time.js';
import type { RangeQuery } from './metrics.schemas.js';
import { type Db, minutesBetween, ROW_LIMIT, resolveRange, taskWhere, viaTask } from './metrics.shared.js';

const MAX_PROJECTS = 20;
const MAX_REASONS = 10;
const BLOCKER_REASON_LIMIT = 1000;
const OPEN = ['todo', 'in_progress'] as TaskStatus[];

export type Distribution = {
	/** Open and completed (in the period) tasks per project, most completed first; `projectId: null` is "no project". */
	byProject: { completed: number; open: number; projectId: string | null; title: string | null }[];
	/** Open tasks now vs. tasks completed in the period, per priority. */
	byPriority: { completed: number; open: number; priority: TaskPriority }[];
	/** All the tasks of the user, per status (not limited to the period). */
	byStatus: { count: number; status: TaskStatus }[];
	range: { from: string; to: string };
};

const priorities: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
const statuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

export const getDistribution = async (prisma: Db, ownerId: string, query: RangeQuery, now: Date = new Date()): Promise<Distribution> => {
	const range = await resolveRange(prisma, ownerId, query, now);
	const completedIn = { gte: range.start, lt: range.end };
	const [status, openByPriority, doneByPriority, openByProject, doneByProject] = await Promise.all([
		prisma.task.groupBy({ _count: { _all: true }, by: ['status'], where: scoped(ownerId, taskWhere(query)) }),
		prisma.task.groupBy({ _count: { _all: true }, by: ['priority'], where: scoped(ownerId, { status: { in: OPEN }, ...taskWhere(query) }) }),
		prisma.task.groupBy({ _count: { _all: true }, by: ['priority'], where: scoped(ownerId, { completedAt: completedIn, ...taskWhere(query) }) }),
		prisma.task.groupBy({ _count: { _all: true }, by: ['projectId'], where: scoped(ownerId, { status: { in: OPEN }, ...taskWhere(query) }) }),
		prisma.task.groupBy({ _count: { _all: true }, by: ['projectId'], where: scoped(ownerId, { completedAt: completedIn, ...taskWhere(query) }) }),
	]);

	const projects = new Map<string | null, { completed: number; open: number }>();
	for (const row of openByProject) projects.set(row.projectId, { completed: 0, open: row._count._all });
	for (const row of doneByProject) projects.set(row.projectId, { completed: row._count._all, open: projects.get(row.projectId)?.open ?? 0 });
	const top = [...projects.entries()].sort((a, b) => b[1].completed - a[1].completed || b[1].open - a[1].open).slice(0, MAX_PROJECTS);
	const ids = top.flatMap(([projectId]) => (projectId ? [projectId] : []));
	const titles = new Map(
		(ids.length ? await prisma.project.findMany({ select: { id: true, title: true }, where: scoped(ownerId, { id: { in: ids } }) }) : []).map(project => [project.id, project.title])
	);

	const countOf = <K extends string>(rows: ({ _count: { _all: number } } & Record<string, unknown>)[], key: string, value: K): number => rows.find(row => row[key] === value)?._count._all ?? 0;
	return {
		byPriority: priorities.map(priority => ({ completed: countOf(doneByPriority, 'priority', priority), open: countOf(openByPriority, 'priority', priority), priority })),
		byProject: top.map(([projectId, figures]) => ({ ...figures, projectId, title: projectId ? (titles.get(projectId) ?? null) : null })),
		byStatus: statuses.map(item => ({ count: countOf(status, 'status', item), status: item })),
		range: { from: range.from, to: range.to },
	};
};

export type BlockerReason = {
	/** Average hours from start to resolution, over the resolved ones; `null` when none is resolved. */
	averageResolutionHours: number | null;
	occurrences: number;
	/** Reason as first written; blockers are grouped ignoring case and surrounding spaces. */
	reason: string;
	stillOpen: number;
};
export type BlockerMetrics = { open: number; range: { from: string; to: string }; reasons: BlockerReason[]; resolved: number; total: number };

/** Blockers started in the period, grouped by reason (most frequent first). */
export const getBlockers = async (prisma: Db, ownerId: string, query: RangeQuery, now: Date = new Date()): Promise<BlockerMetrics> => {
	const range = await resolveRange(prisma, ownerId, query, now);
	const blockers = await prisma.taskBlocker.findMany({
		orderBy: { startedAt: 'asc' },
		select: { reason: true, resolvedAt: true, startedAt: true },
		take: BLOCKER_REASON_LIMIT,
		where: scoped(ownerId, { startedAt: { gte: range.start, lt: range.end }, ...viaTask(query) }),
	});
	const groups = new Map<string, { hours: number[]; occurrences: number; reason: string; stillOpen: number }>();
	for (const blocker of blockers) {
		const key = blocker.reason.trim().toLowerCase();
		const group = groups.get(key) ?? { hours: [], occurrences: 0, reason: blocker.reason.trim(), stillOpen: 0 };
		group.occurrences += 1;
		if (blocker.resolvedAt) group.hours.push(minutesBetween(blocker.startedAt, blocker.resolvedAt) / 60);
		else group.stillOpen += 1;
		groups.set(key, group);
	}
	const reasons = [...groups.values()]
		.sort((a, b) => b.occurrences - a.occurrences || a.reason.localeCompare(b.reason))
		.slice(0, MAX_REASONS)
		.map(({ hours, occurrences, reason, stillOpen }) => ({
			averageResolutionHours: hours.length ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10 : null,
			occurrences,
			reason,
			stillOpen,
		}));
	const open = blockers.filter(blocker => !blocker.resolvedAt).length;
	return { open, range: { from: range.from, to: range.to }, reasons, resolved: blockers.length - open, total: blockers.length };
};

export type Rhythm = {
	/** Completed tasks per local hour of the day (all 24 hours). */
	byHour: { completed: number; hour: number }[];
	/** Completed tasks per ISO weekday (1 = Monday ... 7 = Sunday). */
	byWeekday: { completed: number; weekday: number }[];
	/** Hour and weekday with the most completions; `null` when nothing was completed. */
	peak: { hour: number; weekday: number } | null;
	range: { from: string; to: string };
	total: number;
};

/** When the user gets things done: completed tasks of the period by weekday and hour, in their timezone. */
export const getRhythm = async (prisma: Db, ownerId: string, query: RangeQuery, now: Date = new Date()): Promise<Rhythm> => {
	const range = await resolveRange(prisma, ownerId, query, now);
	const completed = await prisma.task.findMany({ select: { completedAt: true }, take: ROW_LIMIT, where: scoped(ownerId, { completedAt: { gte: range.start, lt: range.end }, ...taskWhere(query) }) });
	const byHour = Array.from({ length: 24 }, (_, hour) => ({ completed: 0, hour }));
	const byWeekday = Array.from({ length: 7 }, (_, index) => ({ completed: 0, weekday: index + 1 }));
	for (const task of completed) {
		if (!task.completedAt) continue;
		const hour = byHour[localHourOf(task.completedAt, range.timeZone)];
		const weekday = byWeekday[isoWeekday(localDateOf(task.completedAt, range.timeZone)) - 1];
		if (hour) hour.completed += 1;
		if (weekday) weekday.completed += 1;
	}
	const best = <T extends { completed: number }>(items: T[]): T | undefined => items.reduce<T | undefined>((top, item) => (item.completed > (top?.completed ?? 0) ? item : top), undefined);
	const peakHour = best(byHour);
	const peakWeekday = best(byWeekday);
	return { byHour, byWeekday, peak: peakHour && peakWeekday ? { hour: peakHour.hour, weekday: peakWeekday.weekday } : null, range: { from: range.from, to: range.to }, total: completed.length };
};
