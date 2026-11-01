import type { Prisma, PrismaClient, Project, ProjectStatus, Tag } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Cursor, keysetAfter, keysetOrder } from '../../lib/pagination.js';
import { markConverted } from '../inbox/inbox.service.js';
import type { CreateProjectInput, UpdateProjectInput } from './projects.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type ProjectWithTags = Project & { tags: Tag[] };

const withTags = { tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' as const } } } };
type Row = Project & { tags: { tag: Tag }[] };
const flatten = ({ tags, ...project }: Row): ProjectWithTags => ({ ...project, tags: tags.map(link => link.tag) });

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

/** Fetches `limit + 1` rows after `cursor` (newest first); pass them to `toPage`. Archived projects are hidden unless asked for. */
export const listProjects = async (
	prisma: PrismaClient,
	ownerId: string,
	filters: { archived: boolean; goalId?: string; status?: ProjectStatus },
	limit: number,
	cursor?: Cursor
): Promise<ProjectWithTags[]> => {
	const rows = await prisma.project.findMany({
		include: withTags,
		orderBy: keysetOrder('createdAt'),
		take: limit + 1,
		where: {
			...scoped(ownerId, { archivedAt: filters.archived ? { not: null } : null, ...(filters.goalId && { goalId: filters.goalId }), ...(filters.status && { status: filters.status }) }),
			...keysetAfter('createdAt', cursor),
		},
	});
	return rows.map(flatten);
};

export const getProject = async (prisma: Db, ownerId: string, id: string): Promise<ProjectWithTags> => {
	const project = await prisma.project.findFirst({ include: withTags, where: scoped(ownerId, { id }) });
	if (!project) throw new AppError('not_found', 404);
	return flatten(project);
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
