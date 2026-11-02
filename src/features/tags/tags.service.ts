import type { PrismaClient, Tag } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs } from '../../lib/pagination.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import type { tagSortFields } from './tags.schemas.js';

type TagSort = (typeof tagSortFields)[number];

/** How many tasks, projects and notes carry the tag. */
export type TagUsage = { notes: number; projects: number; tasks: number };
export type TagWithUsage = Tag & { usage: TagUsage };
export type TagListFilters = { order?: 'asc' | 'desc'; q?: string; sort?: TagSort };

const withUsage = { _count: { select: { notes: true, projects: true, tasks: true } } } as const;
type Row = Tag & { _count: TagUsage };
const toTag = ({ _count, ...tag }: Row): TagWithUsage => ({ ...tag, usage: _count });

const ORDER_BY_FIELD = new Set<TagSort>(['name', 'createdAt', 'updatedAt']);

/** One page of the owner's tags (A–Z by default) with where each is used. `q` matches the name anywhere, ignoring case. */
export const listTags = async (prisma: PrismaClient, ownerId: string, filters: TagListFilters, page: PageParams): Promise<Paged<TagWithUsage>> => {
	const where = scoped(ownerId, filters.q ? { name: { contains: filters.q, mode: 'insensitive' as const } } : {});
	const sort = filters.sort ?? 'name';
	const order = filters.order ?? 'asc';
	const orderBy = [
		ORDER_BY_FIELD.has(sort)
			? ({ [sort]: order } as Record<'createdAt' | 'name' | 'updatedAt', 'asc' | 'desc'>)
			: ({ [sort]: { _count: order } } as Record<'notes' | 'projects' | 'tasks', { _count: 'asc' | 'desc' }>),
		{ id: order },
	];
	const [rows, total] = await Promise.all([prisma.tag.findMany({ include: withUsage, orderBy, ...pageArgs(page), where }), prisma.tag.count({ where })]);
	return { items: rows.map(toTag), total };
};

export const createTag = async (prisma: PrismaClient, ownerId: string, name: string): Promise<TagWithUsage> => {
	try {
		return toTag(await prisma.tag.create({ data: { name, ownerId }, include: withUsage }));
	} catch (error) {
		if (isUniqueViolation(error)) throw new AppError('already_exists', 409);
		throw error;
	}
};

/** Renaming to the current name changes nothing and answers with the tag as it is. */
export const renameTag = async (prisma: PrismaClient, ownerId: string, id: string, name: string): Promise<TagWithUsage> => {
	const current = await prisma.tag.findFirst({ include: withUsage, where: scoped(ownerId, { id }) });
	if (!current) throw new AppError('not_found', 404);
	if (!hasChanges(changedFields(current, { name }))) return toTag(current);
	try {
		const { count } = await prisma.tag.updateMany({ data: { name }, where: scoped(ownerId, { id }) });
		if (count === 0) throw new AppError('not_found', 404);
	} catch (error) {
		if (isUniqueViolation(error)) throw new AppError('already_exists', 409);
		throw error;
	}
	const tag = await prisma.tag.findFirst({ include: withUsage, where: scoped(ownerId, { id }) });
	if (!tag) throw new AppError('not_found', 404);
	return toTag(tag);
};

/** Deletes the tag; its links to tasks/projects/notes cascade in the database, the linked items stay. */
export const deleteTag = async (prisma: PrismaClient, ownerId: string, id: string): Promise<void> => {
	const { count } = await prisma.tag.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
};
