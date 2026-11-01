import type { Tag } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createTag, deleteTag, listTags, renameTag } from './tags.service.js';

const TAG_ID = '0b9c7d1a-5e2f-4c3b-9a8d-6f4e3d2c1b0a';
const tag = { id: TAG_ID, name: 'work', ownerId: TEST_USER_ID } as Tag;
const unique = () => Object.assign(new Error('unique'), { code: 'P2002' });

const rejection = async (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('listTags', () => {
	it('lists only the owner tags sorted by name', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([tag]);

		expect(await listTags(prisma, TEST_USER_ID)).toEqual([tag]);
		expect(prisma.tag.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' }, where: { ownerId: TEST_USER_ID } });
	});
});

describe('createTag', () => {
	it('creates the tag for the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.create).mockResolvedValue(tag);

		expect(await createTag(prisma, TEST_USER_ID, 'work')).toBe(tag);
		expect(prisma.tag.create).toHaveBeenCalledWith({ data: { name: 'work', ownerId: TEST_USER_ID } });
	});

	it('answers already_exists (409) when the name is taken by the same owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.create).mockRejectedValue(unique());

		const error = await rejection(createTag(prisma, TEST_USER_ID, 'work'));
		expect(error).toBeInstanceOf(AppError);
		expect(error).toMatchObject({ code: 'already_exists', status: 409 });
	});

	it('rethrows unexpected errors', async () => {
		const prisma = createMockPrisma();
		const boom = new Error('db down');
		vi.mocked(prisma.tag.create).mockRejectedValue(boom);
		expect(await rejection(createTag(prisma, TEST_USER_ID, 'work'))).toBe(boom);
	});
});

describe('renameTag', () => {
	it('renames an owned tag and returns it', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.tag.findFirst).mockResolvedValue({ ...tag, name: 'home' });

		expect(await renameTag(prisma, TEST_USER_ID, TAG_ID, 'home')).toMatchObject({ name: 'home' });
		expect(prisma.tag.updateMany).toHaveBeenCalledWith({ data: { name: 'home' }, where: { id: TAG_ID, ownerId: TEST_USER_ID } });
	});

	it('answers not_found (404) for a tag of another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.updateMany).mockResolvedValue({ count: 0 });

		expect(await rejection(renameTag(prisma, OTHER_USER_ID, TAG_ID, 'home'))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.tag.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TAG_ID, ownerId: OTHER_USER_ID } }));
		expect(prisma.tag.findFirst).not.toHaveBeenCalled();
	});

	it('answers already_exists (409) when the new name is taken', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.updateMany).mockRejectedValue(unique());
		expect(await rejection(renameTag(prisma, TEST_USER_ID, TAG_ID, 'home'))).toMatchObject({ code: 'already_exists', status: 409 });
	});
});

describe('deleteTag', () => {
	it('deletes an owned tag scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.deleteMany).mockResolvedValue({ count: 1 });

		await deleteTag(prisma, TEST_USER_ID, TAG_ID);
		expect(prisma.tag.deleteMany).toHaveBeenCalledWith({ where: { id: TAG_ID, ownerId: TEST_USER_ID } });
	});

	it('answers not_found (404) when nothing was deleted', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.deleteMany).mockResolvedValue({ count: 0 });
		expect(await rejection(deleteTag(prisma, OTHER_USER_ID, TAG_ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
