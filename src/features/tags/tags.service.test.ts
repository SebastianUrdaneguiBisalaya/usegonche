import type { Tag } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createTag, deleteTag, listTags, updateTag } from './tags.service.js';

const TAG_ID = '0b9c7d1a-5e2f-4c3b-9a8d-6f4e3d2c1b0a';
const tag = { color: null, id: TAG_ID, name: 'work', ownerId: TEST_USER_ID } as Tag;
const usage = { notes: 1, projects: 2, tasks: 3 };
const row = { ...tag, _count: usage };
const withUsage = { ...tag, usage };
const unique = () => Object.assign(new Error('unique'), { code: 'P2002' });

const rejection = async (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('listTags', () => {
	it('lists only the owner tags A–Z with their usage', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([row]);
		vi.mocked(prisma.tag.count).mockResolvedValue(1);

		expect(await listTags(prisma, TEST_USER_ID, {}, { page: 1, pageSize: 20 })).toEqual({ items: [withUsage], total: 1 });
		expect(prisma.tag.findMany).toHaveBeenCalledWith({
			include: { _count: { select: { notes: true, projects: true, tasks: true } } },
			orderBy: [{ name: 'asc' }, { id: 'asc' }],
			skip: 0,
			take: 20,
			where: { ownerId: TEST_USER_ID },
		});
	});

	it('searches the name ignoring case, on a later page', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
		vi.mocked(prisma.tag.count).mockResolvedValue(0);

		await listTags(prisma, TEST_USER_ID, { q: 'wo' }, { page: 3, pageSize: 10 });
		expect(prisma.tag.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10, where: { name: { contains: 'wo', mode: 'insensitive' }, ownerId: TEST_USER_ID } }));
		expect(prisma.tag.count).toHaveBeenCalledWith({ where: { name: { contains: 'wo', mode: 'insensitive' }, ownerId: TEST_USER_ID } });
	});

	it.each([
		['updatedAt', 'desc', [{ updatedAt: 'desc' }, { id: 'desc' }]],
		['tasks', 'desc', [{ tasks: { _count: 'desc' } }, { id: 'desc' }]],
		['notes', 'asc', [{ notes: { _count: 'asc' } }, { id: 'asc' }]],
	] as const)('sorts by %s %s', async (sort, order, orderBy) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
		vi.mocked(prisma.tag.count).mockResolvedValue(0);

		await listTags(prisma, TEST_USER_ID, { order, sort }, { page: 1, pageSize: 20 });
		expect(prisma.tag.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy }));
	});
});

describe('createTag', () => {
	it('creates the tag for the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.create).mockResolvedValue({ ...tag, _count: { notes: 0, projects: 0, tasks: 0 } } as Tag);

		expect(await createTag(prisma, TEST_USER_ID, { name: 'work' })).toEqual({ ...tag, usage: { notes: 0, projects: 0, tasks: 0 } });
		expect(prisma.tag.create).toHaveBeenCalledWith(expect.objectContaining({ data: { color: undefined, name: 'work', ownerId: TEST_USER_ID } }));
	});

	it('answers already_exists (409) when the name is taken by the same owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.create).mockRejectedValue(unique());

		const error = await rejection(createTag(prisma, TEST_USER_ID, { name: 'work' }));
		expect(error).toBeInstanceOf(AppError);
		expect(error).toMatchObject({ code: 'already_exists', status: 409 });
	});

	it('rethrows unexpected errors', async () => {
		const prisma = createMockPrisma();
		const boom = new Error('db down');
		vi.mocked(prisma.tag.create).mockRejectedValue(boom);
		expect(await rejection(createTag(prisma, TEST_USER_ID, { name: 'work' }))).toBe(boom);
	});
});

describe('createTag with a color', () => {
	it('stores the color the user picked', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.create).mockResolvedValue({ ...tag, color: '#3b82f6', _count: usage } as Tag);
		expect(await createTag(prisma, TEST_USER_ID, { color: '#3b82f6', name: 'work' })).toMatchObject({ color: '#3b82f6', usage });
		expect(prisma.tag.create).toHaveBeenCalledWith(expect.objectContaining({ data: { color: '#3b82f6', name: 'work', ownerId: TEST_USER_ID } }));
	});
});

describe('updateTag', () => {
	it('writes only the color when only the color changed, and removes it with null', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.tag.findFirst).mockResolvedValue({ ...row, color: '#3b82f6' } as never);

		await updateTag(prisma, TEST_USER_ID, TAG_ID, { color: null, name: 'work' });
		expect(prisma.tag.updateMany).toHaveBeenCalledWith({ data: { color: null }, where: { id: TAG_ID, ownerId: TEST_USER_ID } });
	});

	it('is idempotent when name and color are the stored ones', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue({ ...row, color: '#3b82f6' } as never);
		await updateTag(prisma, TEST_USER_ID, TAG_ID, { color: '#3b82f6', name: 'work' });
		expect(prisma.tag.updateMany).not.toHaveBeenCalled();
	});

	it('renames an owned tag and returns it', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.tag.findFirst)
			.mockResolvedValueOnce(row)
			.mockResolvedValue({ ...row, name: 'home' });

		expect(await updateTag(prisma, TEST_USER_ID, TAG_ID, { name: 'home' })).toMatchObject({ name: 'home', usage });
		expect(prisma.tag.updateMany).toHaveBeenCalledWith({ data: { name: 'home' }, where: { id: TAG_ID, ownerId: TEST_USER_ID } });
	});

	it('is idempotent: renaming to the current name answers the tag and writes nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue(row);
		expect(await updateTag(prisma, TEST_USER_ID, TAG_ID, { name: tag.name })).toEqual(withUsage);
		expect(prisma.tag.updateMany).not.toHaveBeenCalled();
	});

	it('answers not_found (404) for a tag of another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue(null);

		expect(await rejection(updateTag(prisma, OTHER_USER_ID, TAG_ID, { name: 'home' }))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.tag.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TAG_ID, ownerId: OTHER_USER_ID } }));
		expect(prisma.tag.updateMany).not.toHaveBeenCalled();
	});

	it('answers already_exists (409) when the new name is taken', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue(row);
		vi.mocked(prisma.tag.updateMany).mockRejectedValue(unique());
		expect(await rejection(updateTag(prisma, TEST_USER_ID, TAG_ID, { name: 'home' }))).toMatchObject({ code: 'already_exists', status: 409 });
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
