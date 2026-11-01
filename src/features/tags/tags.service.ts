import type { PrismaClient, Tag } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';

export const listTags = (prisma: PrismaClient, ownerId: string): Promise<Tag[]> => prisma.tag.findMany({ orderBy: { name: 'asc' }, where: scoped(ownerId) });

export const createTag = async (prisma: PrismaClient, ownerId: string, name: string): Promise<Tag> => {
	try {
		return await prisma.tag.create({ data: { name, ownerId } });
	} catch (error) {
		if (isUniqueViolation(error)) throw new AppError('already_exists', 409);
		throw error;
	}
};

/** Renaming to the current name changes nothing and answers with the tag as it is. */
export const renameTag = async (prisma: PrismaClient, ownerId: string, id: string, name: string): Promise<Tag> => {
	const current = await prisma.tag.findFirst({ where: scoped(ownerId, { id }) });
	if (!current) throw new AppError('not_found', 404);
	if (!hasChanges(changedFields(current, { name }))) return current;
	try {
		const { count } = await prisma.tag.updateMany({ data: { name }, where: scoped(ownerId, { id }) });
		if (count === 0) throw new AppError('not_found', 404);
	} catch (error) {
		if (isUniqueViolation(error)) throw new AppError('already_exists', 409);
		throw error;
	}
	const tag = await prisma.tag.findFirst({ where: scoped(ownerId, { id }) });
	if (!tag) throw new AppError('not_found', 404);
	return tag;
};

/** Deletes the tag; its links to tasks/projects/notes cascade in the database, the linked items stay. */
export const deleteTag = async (prisma: PrismaClient, ownerId: string, id: string): Promise<void> => {
	const { count } = await prisma.tag.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
};
