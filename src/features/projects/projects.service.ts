import type { Prisma, PrismaClient, Project, ProjectStatus, Tag } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type PageParams, pageArgs } from '../../lib/pagination.js';
import { markConverted } from '../inbox/inbox.service.js';
import type { CreateProjectInput, projectSortFields, UpdateProjectInput } from './projects.schemas.js';

type ProjectSort = (typeof projectSortFields)[number];

type Db = PrismaClient | Prisma.TransactionClient;

/** Progress of a project: tasks that count (cancelled ones do not) and how many of them are done. */
export type TaskCounts = { done: number; total: number };
export type ProjectWithTags = Project & { tags: Tag[]; taskCounts: TaskCounts };
export type ProjectListFilters = { archived: boolean; goalId?: string; order?: 'asc' | 'desc'; sort?: ProjectSort; status?: ProjectStatus; tagId?: string };
/** Projects per tab: one counter per status (not archived) plus the archived ones. */
export type ProjectCounts = Record<ProjectStatus | 'archived', number>;
export type ProjectPage = { counts: ProjectCounts; items: ProjectWithTags[]; total: number };

const withTags = { tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' as const } } } };
type Row = Project & { tags: { tag: Tag }[] };

/** Done / counting tasks of each project, from one grouped query (cancelled tasks are left out of the total). */
const attachTaskCounts = async (prisma: Db, ownerId: string, rows: Row[]): Promise<ProjectWithTags[]> => {
	if (rows.length === 0) return [];
	const grouped = await prisma.task.groupBy({
		_count: { _all: true },
		by: ['projectId', 'status'],
		where: scoped(ownerId, { projectId: { in: rows.map(row => row.id) }, status: { not: 'cancelled' as const } }),
	});
	const counts = new Map<string, TaskCounts>();
	for (const group of grouped) {
		if (!group.projectId) continue;
		const current = counts.get(group.projectId) ?? { done: 0, total: 0 };
		current.total += group._count._all;
		if (group.status === 'done') current.done += group._count._all;
		counts.set(group.projectId, current);
	}
	return rows.map(({ tags, ...project }) => ({ ...project, tags: tags.map(link => link.tag), taskCounts: counts.get(project.id) ?? { done: 0, total: 0 } }));
};

const invalidReference = (field: string): AppError => new AppError('validation_error', 422, [{ code: 'not_found', field }]);

/** The goal must exist and belong to the owner. */
const assertGoal = async (prisma: Db, ownerId: string, goalId: string): Promise<void> => {
	const goal = await prisma.goal.findFirst({ select: { id: true }, where: scoped(ownerId, { id: goalId }) });
	if (!goal) throw invalidReference('goalId');
};

/** Every tag must exist and belong to the owner. */
const assertTags = async (prisma: Db, ownerId: string, tagIds: string[]): Promise<void> => {
	if (tagIds.length === 0) return;
	const count = await prisma.tag.count({ where: scoped(ownerId, { id: { in: tagIds } }) });
	if (count !== tagIds.length) throw invalidReference('tagIds');
};

const tagFilter = (tagId?: string) => (tagId ? { tags: { some: { tagId } } } : {});

/**
 * One page of projects (archived ones only when asked for) with the counter of every tab. The counters follow the goal and tag
 * filters but not the status, so each tab shows how many projects it would hold. `total` is the count of the requested tab.
 */
export const listProjects = async (prisma: PrismaClient, ownerId: string, filters: ProjectListFilters, page: PageParams): Promise<ProjectPage> => {
	const shared = { ...(filters.goalId && { goalId: filters.goalId }), ...tagFilter(filters.tagId) };
	const where = scoped(ownerId, { archivedAt: filters.archived ? { not: null } : null, ...shared, ...(filters.status && { status: filters.status }) });
	const sort = filters.sort ?? 'createdAt';
	const order = filters.order ?? 'desc';
	const orderBy = [{ [sort]: order } as Record<ProjectSort, 'asc' | 'desc'>, { id: order }];
	const [rows, total, grouped, archived] = await Promise.all([
		prisma.project.findMany({ include: withTags, orderBy, ...pageArgs(page), where }),
		prisma.project.count({ where }),
		prisma.project.groupBy({ _count: { _all: true }, by: ['status'], where: scoped(ownerId, { archivedAt: null, ...shared }) }),
		prisma.project.count({ where: scoped(ownerId, { archivedAt: { not: null }, ...shared }) }),
	]);
	const counts: ProjectCounts = { active: 0, archived, completed: 0, on_hold: 0 };
	for (const group of grouped) counts[group.status] = group._count._all;
	return { counts, items: await attachTaskCounts(prisma, ownerId, rows), total };
};

export const getProject = async (prisma: Db, ownerId: string, id: string): Promise<ProjectWithTags> => {
	const project = await prisma.project.findFirst({ include: withTags, where: scoped(ownerId, { id }) });
	if (!project) throw new AppError('not_found', 404);
	const [withCounts] = await attachTaskCounts(prisma, ownerId, [project]);
	return withCounts as ProjectWithTags;
};

/** With `originInboxItemId` the inbox item is marked converted in the same transaction (404 if not the owner's, 409 if not pending). */
export const createProject = (prisma: PrismaClient, ownerId: string, input: CreateProjectInput): Promise<ProjectWithTags> =>
	prisma.$transaction(async tx => {
		if (input.goalId) await assertGoal(tx, ownerId, input.goalId);
		await assertTags(tx, ownerId, input.tagIds);
		if (input.originInboxItemId) await markConverted(tx, ownerId, input.originInboxItemId);
		const { id } = await tx.project.create({
			data: {
				description: input.description,
				goalId: input.goalId,
				originInboxItemId: input.originInboxItemId,
				ownerId,
				tags: { create: input.tagIds.map(tagId => ({ tagId })) },
				title: input.title,
			},
			select: { id: true },
		});
		return getProject(tx, ownerId, id);
	});

/** Writes only what changed (tags are compared as a set); an update that changes nothing answers with the current project and writes nothing. */
export const updateProject = (prisma: PrismaClient, ownerId: string, id: string, { tagIds, ...fields }: UpdateProjectInput): Promise<ProjectWithTags> =>
	prisma.$transaction(async tx => {
		const current = await getProject(tx, ownerId, id);
		const { tagIds: newTagIds, ...changes } = changedFields({ ...current, tagIds: current.tags.map(tag => tag.id) }, { ...fields, tagIds }, { unordered: ['tagIds'] });
		if (!hasChanges(changes) && !newTagIds) return current;

		if (changes.goalId) await assertGoal(tx, ownerId, changes.goalId);
		if (newTagIds) await assertTags(tx, ownerId, newTagIds);
		if (hasChanges(changes)) await tx.project.updateMany({ data: changes, where: scoped(ownerId, { id }) });
		if (newTagIds) {
			await tx.projectTag.deleteMany({ where: { projectId: id } });
			await tx.projectTag.createMany({ data: newTagIds.map(tagId => ({ projectId: id, tagId })) });
		}
		return getProject(tx, ownerId, id);
	});

/** Idempotent: keeps the original `archivedAt`. The project's tasks are untouched. */
export const archiveProject = async (prisma: PrismaClient, ownerId: string, id: string): Promise<ProjectWithTags> => {
	await prisma.project.updateMany({ data: { archivedAt: new Date() }, where: scoped(ownerId, { archivedAt: null, id }) });
	return getProject(prisma, ownerId, id);
};

export const unarchiveProject = async (prisma: PrismaClient, ownerId: string, id: string): Promise<ProjectWithTags> => {
	await prisma.project.updateMany({ data: { archivedAt: null }, where: scoped(ownerId, { archivedAt: { not: null }, id }) });
	return getProject(prisma, ownerId, id);
};
