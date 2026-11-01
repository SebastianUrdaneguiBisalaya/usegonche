import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { archiveProject, createProject, getProject, listProjects, unarchiveProject, updateProject } from './projects.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const GOAL_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const TAG_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const INBOX_ID = 'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';
const tag = { id: TAG_ID, name: 'work', ownerId: TEST_USER_ID };
const row = { id: ID, ownerId: TEST_USER_ID, tags: [{ tag }], title: 'Launch' };
const project = { id: ID, ownerId: TEST_USER_ID, tags: [tag], title: 'Launch' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('listProjects', () => {
	it('hides archived by default, scopes by owner and flattens tags', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.findMany).mockResolvedValue(asRow([row]));

		expect(await listProjects(prisma, TEST_USER_ID, { archived: false }, 20)).toEqual([project]);
		expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21, where: { archivedAt: null, ownerId: TEST_USER_ID } }));
	});

	it('filters by goal and status', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.findMany).mockResolvedValue([]);

		await listProjects(prisma, TEST_USER_ID, { archived: true, goalId: GOAL_ID, status: 'on_hold' }, 10);
		expect(vi.mocked(prisma.project.findMany).mock.calls[0]?.[0]?.where).toEqual({ archivedAt: { not: null }, goalId: GOAL_ID, ownerId: TEST_USER_ID, status: 'on_hold' });
	});
});

describe('getProject', () => {
	it('returns the project with flattened tags', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));
		expect(await getProject(prisma, TEST_USER_ID, ID)).toEqual(project);
	});

	it('throws 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		expect(await rejection(getProject(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(vi.mocked(prisma.project.findFirst).mock.calls[0]?.[0]?.where).toEqual({ id: ID, ownerId: OTHER_USER_ID });
	});
});

describe('createProject', () => {
	const input = { tagIds: [], title: 'Launch' };

	it('creates a project with tags after checking goal and tags belong to the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(asRow({ id: GOAL_ID }));
		vi.mocked(prisma.tag.count).mockResolvedValue(1);
		vi.mocked(prisma.project.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));

		expect(await createProject(prisma, TEST_USER_ID, { ...input, goalId: GOAL_ID, tagIds: [TAG_ID] })).toEqual(project);
		expect(prisma.goal.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { id: GOAL_ID, ownerId: TEST_USER_ID } });
		expect(prisma.tag.count).toHaveBeenCalledWith({ where: { id: { in: [TAG_ID] }, ownerId: TEST_USER_ID } });
		expect(prisma.project.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ goalId: GOAL_ID, ownerId: TEST_USER_ID, tags: { create: [{ tagId: TAG_ID }] } }) })
		);
	});

	it('rejects a goal that is not the owner’s with 422', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);

		expect(await rejection(createProject(prisma, TEST_USER_ID, { ...input, goalId: GOAL_ID }))).toMatchObject({
			code: 'validation_error',
			details: [{ code: 'not_found', field: 'goalId' }],
			status: 422,
		});
		expect(prisma.project.create).not.toHaveBeenCalled();
	});

	it('rejects tags that are not all the owner’s with 422', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.count).mockResolvedValue(0);

		expect(await rejection(createProject(prisma, TEST_USER_ID, { ...input, tagIds: [TAG_ID] }))).toMatchObject({ details: [{ code: 'not_found', field: 'tagIds' }], status: 422 });
		expect(prisma.project.create).not.toHaveBeenCalled();
	});

	it('converts the origin inbox item in the same transaction', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.project.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));

		await createProject(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID });
		expect(prisma.inboxItem.updateMany).toHaveBeenCalledWith({ data: { processedAt: expect.any(Date), status: 'converted' }, where: { id: INBOX_ID, ownerId: TEST_USER_ID, status: 'pending' } });
		expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ originInboxItemId: INBOX_ID }) }));
	});

	it('fails with 404 / 409 and creates nothing when the inbox item cannot be converted', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(null);
		expect(await rejection(createProject(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID }))).toMatchObject({ code: 'not_found', status: 404 });

		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(asRow({ id: INBOX_ID }));
		expect(await rejection(createProject(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID }))).toMatchObject({ code: 'invalid_state', status: 409 });
		expect(prisma.project.create).not.toHaveBeenCalled();
	});
});

describe('updateProject', () => {
	const TAG2 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
	const stored = { ...row, goalId: GOAL_ID, status: 'active' };

	it('writes only the changed fields and replaces the tag set when it changes', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.count).mockResolvedValue(1);
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(stored));

		expect(await updateProject(prisma, TEST_USER_ID, ID, { status: 'completed', tagIds: [TAG2], title: 'Launch' })).toMatchObject({ id: ID });
		expect(prisma.project.updateMany).toHaveBeenCalledWith({ data: { status: 'completed' }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.projectTag.deleteMany).toHaveBeenCalledWith({ where: { projectId: ID } });
		expect(prisma.projectTag.createMany).toHaveBeenCalledWith({ data: [{ projectId: ID, tagId: TAG2 }] });
	});

	it('is idempotent: same values and the same tags (any order) answer the project and write nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(stored));
		expect(await updateProject(prisma, TEST_USER_ID, ID, { goalId: GOAL_ID, status: 'active', tagIds: [TAG_ID], title: 'Launch' })).toEqual({ ...project, goalId: GOAL_ID, status: 'active' });
		expect(prisma.project.updateMany).not.toHaveBeenCalled();
		expect(prisma.projectTag.deleteMany).not.toHaveBeenCalled();
		expect(prisma.projectTag.createMany).not.toHaveBeenCalled();
	});

	it('replaces only the tags when only they change', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.count).mockResolvedValue(0);
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(stored));
		await updateProject(prisma, TEST_USER_ID, ID, { tagIds: [] });
		expect(prisma.project.updateMany).not.toHaveBeenCalled();
		expect(prisma.projectTag.deleteMany).toHaveBeenCalledWith({ where: { projectId: ID } });
		expect(prisma.projectTag.createMany).toHaveBeenCalledWith({ data: [] });
	});

	it('leaves tags alone when tagIds is not sent and unlinks the goal with null', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(stored));

		await updateProject(prisma, TEST_USER_ID, ID, { goalId: null });
		expect(prisma.project.updateMany).toHaveBeenCalledWith({ data: { goalId: null }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.projectTag.deleteMany).not.toHaveBeenCalled();
		expect(prisma.goal.findFirst).not.toHaveBeenCalled();
	});

	it('throws 404 for another owner’s project without touching tags', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

		expect(await rejection(updateProject(prisma, OTHER_USER_ID, ID, { tagIds: [] }))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.projectTag.deleteMany).not.toHaveBeenCalled();
	});

	it('rejects a new goal that is not the owner’s with 422', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow({ ...stored, goalId: null }));
		vi.mocked(prisma.goal.findFirst).mockResolvedValue(null);
		expect(await rejection(updateProject(prisma, TEST_USER_ID, ID, { goalId: GOAL_ID }))).toMatchObject({ status: 422 });
		expect(prisma.project.updateMany).not.toHaveBeenCalled();
	});
});

describe('archiveProject / unarchiveProject', () => {
	it('archives only non-archived projects and touches nothing else (tasks stay)', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));

		await archiveProject(prisma, TEST_USER_ID, ID);
		expect(prisma.project.updateMany).toHaveBeenCalledWith({ data: { archivedAt: expect.any(Date) }, where: { archivedAt: null, id: ID, ownerId: TEST_USER_ID } });
	});

	it('unarchives only archived projects', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow(row));

		await unarchiveProject(prisma, TEST_USER_ID, ID);
		expect(prisma.project.updateMany).toHaveBeenCalledWith({ data: { archivedAt: null }, where: { archivedAt: { not: null }, id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.project.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		expect(await rejection(archiveProject(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(await rejection(unarchiveProject(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
