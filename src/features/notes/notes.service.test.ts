import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createMockStorage, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createNote, deleteNote, excerptOf, getNote, listNotes, restoreRevision, updateNote } from './notes.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const PROJECT_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const TAG_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const TASK_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const INBOX_ID = 'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';
const tag = { id: TAG_ID, name: 'ideas' };
const row = { id: ID, ownerId: TEST_USER_ID, tags: [{ tag }], tasks: [{ taskId: TASK_ID }], title: 'Meeting' };
const view = { id: ID, ownerId: TEST_USER_ID, tags: [tag], taskIds: [TASK_ID], title: 'Meeting' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);
const input = { tagIds: [], taskIds: [], title: 'Meeting' };

describe('excerptOf', () => {
	it('is empty without a body', () => {
		expect(excerptOf(null)).toBe('');
	});

	it('drops the Markdown marks and joins the lines', () => {
		expect(excerptOf('## Key ideas\n\n- **Keep** it [simple](https://x.dev)\n- ![img](a.png) done\n\n```ts\nconst a = 1;\n```')).toBe('Key ideas Keep it simple done');
	});

	it('cuts long bodies with an ellipsis', () => {
		const excerpt = excerptOf('word '.repeat(100));
		expect(excerpt.length).toBeLessThanOrEqual(201);
		expect(excerpt.endsWith('…')).toBe(true);
	});
});

describe('listNotes', () => {
	it('returns an excerpt instead of the body, ordered by last update, scoped by owner and flattening links', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findMany).mockResolvedValue(asRow([{ ...row, body: '# Hello **world**' }]));
		vi.mocked(prisma.note.count).mockResolvedValue(1);
		expect(await listNotes(prisma, TEST_USER_ID, {}, { page: 1, pageSize: 20 })).toEqual({ items: [{ ...view, excerpt: 'Hello world' }], total: 1 });
		const args = vi.mocked(prisma.note.findMany).mock.calls[0]?.[0];
		expect(args).toEqual(expect.objectContaining({ orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20, where: { ownerId: TEST_USER_ID } }));
		expect(args).not.toHaveProperty('omit');
	});

	it('filters by project, tag and task', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findMany).mockResolvedValue([]);
		await listNotes(prisma, TEST_USER_ID, { projectId: PROJECT_ID, tagId: TAG_ID, taskId: TASK_ID }, { page: 1, pageSize: 10 });
		expect(vi.mocked(prisma.note.findMany).mock.calls[0]?.[0]?.where).toEqual({
			ownerId: TEST_USER_ID,
			projectId: PROJECT_ID,
			tags: { some: { tagId: TAG_ID } },
			tasks: { some: { taskId: TASK_ID } },
		});
	});

	it('skips the previous pages keeping the owner scope', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findMany).mockResolvedValue([]);
		await listNotes(prisma, TEST_USER_ID, {}, { page: 2, pageSize: 10 });
		expect(vi.mocked(prisma.note.findMany).mock.calls[0]?.[0]).toMatchObject({ skip: 10, take: 10, where: { ownerId: TEST_USER_ID } });
	});
});

describe('getNote', () => {
	it('returns the note with tags and task ids', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow(row));
		expect(await getNote(prisma, TEST_USER_ID, ID)).toEqual(view);
	});

	it('throws 404 scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
		expect(await rejection(getNote(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(vi.mocked(prisma.note.findFirst).mock.calls[0]?.[0]?.where).toEqual({ id: ID, ownerId: OTHER_USER_ID });
	});
});

describe('createNote', () => {
	const setup = () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.create).mockResolvedValue(asRow({ id: ID }));
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow(row));
		return prisma;
	};

	it('creates the note for the owner linked to project, tags and tasks', async () => {
		const prisma = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(asRow({ id: PROJECT_ID }));
		vi.mocked(prisma.tag.count).mockResolvedValue(1);
		vi.mocked(prisma.task.count).mockResolvedValue(1);

		expect(await createNote(prisma, TEST_USER_ID, { ...input, projectId: PROJECT_ID, tagIds: [TAG_ID], taskIds: [TASK_ID] })).toEqual(view);
		expect(prisma.project.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { id: PROJECT_ID, ownerId: TEST_USER_ID } });
		expect(prisma.task.count).toHaveBeenCalledWith({ where: { id: { in: [TASK_ID] }, ownerId: TEST_USER_ID } });
		expect(prisma.note.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ ownerId: TEST_USER_ID, projectId: PROJECT_ID, tags: { create: [{ tagId: TAG_ID }] }, tasks: { create: [{ taskId: TASK_ID }] } }),
			})
		);
	});

	it('converts the origin inbox item in the same transaction', async () => {
		const prisma = setup();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 1 });
		await createNote(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID });
		expect(prisma.inboxItem.updateMany).toHaveBeenCalledWith({ data: { processedAt: expect.any(Date), status: 'converted' }, where: { id: INBOX_ID, ownerId: TEST_USER_ID, status: 'pending' } });
		expect(prisma.note.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ originInboxItemId: INBOX_ID }) }));
	});

	it('fails with 404 / 409 and creates nothing when the inbox item cannot be converted', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.inboxItem.updateMany).mockResolvedValue({ count: 0 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(null);
		expect(await rejection(createNote(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID }))).toMatchObject({ status: 404 });
		vi.mocked(prisma.inboxItem.findFirst).mockResolvedValue(asRow({ id: INBOX_ID }));
		expect(await rejection(createNote(prisma, TEST_USER_ID, { ...input, originInboxItemId: INBOX_ID }))).toMatchObject({ status: 409 });
		expect(prisma.note.create).not.toHaveBeenCalled();
	});

	type Prisma = ReturnType<typeof createMockPrisma>;
	it.each([
		['projectId', (p: Prisma) => vi.mocked(p.project.findFirst).mockResolvedValue(null)],
		['tagIds', (p: Prisma) => vi.mocked(p.tag.count).mockResolvedValue(0)],
		['taskIds', (p: Prisma) => vi.mocked(p.task.count).mockResolvedValue(0)],
	])('rejects a %s that is not the owner’s with 422', async (field, arrange) => {
		const prisma = createMockPrisma();
		arrange(prisma);
		const refs = { projectId: PROJECT_ID, tagIds: [TAG_ID], taskIds: [TASK_ID] };
		expect(await rejection(createNote(prisma, TEST_USER_ID, { ...input, [field]: refs[field as keyof typeof refs] }))).toMatchObject({ details: [{ code: 'not_found', field }], status: 422 });
		expect(prisma.note.create).not.toHaveBeenCalled();
	});
});

describe('updateNote', () => {
	const TASK2 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e';
	const stored = { ...row, projectId: PROJECT_ID };
	const setup = () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow(stored));
		vi.mocked(prisma.noteRevision.findMany).mockResolvedValue([]);
		return prisma;
	};

	it('writes only the changed fields and replaces the link sets that changed', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.count).mockResolvedValue(1);
		await updateNote(prisma, TEST_USER_ID, ID, { tagIds: [TAG_ID], taskIds: [TASK2], title: 'New' });
		expect(prisma.note.updateMany).toHaveBeenCalledWith({ data: { title: 'New' }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.noteTag.deleteMany).not.toHaveBeenCalled();
		expect(prisma.taskNote.deleteMany).toHaveBeenCalledWith({ where: { noteId: ID } });
		expect(prisma.taskNote.createMany).toHaveBeenCalledWith({ data: [{ noteId: ID, taskId: TASK2 }] });
	});

	it('saves the previous title and body as a revision before a change of either', async () => {
		const prisma = setup();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow({ ...stored, body: 'old body' }));
		await updateNote(prisma, TEST_USER_ID, ID, { body: 'new body' });
		expect(prisma.noteRevision.create).toHaveBeenCalledWith({ data: { body: 'old body', noteId: ID, ownerId: TEST_USER_ID, title: 'Meeting' } });
		await updateNote(prisma, TEST_USER_ID, ID, { title: 'Renamed' });
		expect(prisma.noteRevision.create).toHaveBeenCalledTimes(2);
	});

	it('writes no revision when title and body do not change (links, project, same values)', async () => {
		const prisma = setup();
		vi.mocked(prisma.tag.count).mockResolvedValue(0);
		await updateNote(prisma, TEST_USER_ID, ID, { projectId: null, tagIds: [] });
		await updateNote(prisma, TEST_USER_ID, ID, { title: 'Meeting' });
		expect(prisma.noteRevision.create).not.toHaveBeenCalled();
	});

	it('replaces the tag set when it changes', async () => {
		const prisma = setup();
		vi.mocked(prisma.tag.count).mockResolvedValue(0);
		await updateNote(prisma, TEST_USER_ID, ID, { tagIds: [] });
		expect(prisma.note.updateMany).not.toHaveBeenCalled();
		expect(prisma.noteTag.deleteMany).toHaveBeenCalledWith({ where: { noteId: ID } });
		expect(prisma.noteTag.createMany).toHaveBeenCalledWith({ data: [] });
	});

	it('is idempotent: same values and the same link sets answer the note and write nothing', async () => {
		const prisma = setup();
		expect(await updateNote(prisma, TEST_USER_ID, ID, { projectId: PROJECT_ID, tagIds: [TAG_ID], taskIds: [TASK_ID], title: 'Meeting' })).toEqual({ ...view, projectId: PROJECT_ID });
		expect(prisma.note.updateMany).not.toHaveBeenCalled();
		expect(prisma.noteTag.deleteMany).not.toHaveBeenCalled();
		expect(prisma.taskNote.deleteMany).not.toHaveBeenCalled();
	});

	it('leaves links alone when the sets are not sent and unlinks the project with null', async () => {
		const prisma = setup();
		await updateNote(prisma, TEST_USER_ID, ID, { projectId: null });
		expect(prisma.note.updateMany).toHaveBeenCalledWith({ data: { projectId: null }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.noteTag.deleteMany).not.toHaveBeenCalled();
		expect(prisma.taskNote.deleteMany).not.toHaveBeenCalled();
	});

	it('throws 404 for another owner’s note without touching links', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
		expect(await rejection(updateNote(prisma, OTHER_USER_ID, ID, { taskIds: [] }))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.taskNote.deleteMany).not.toHaveBeenCalled();
	});

	it('rejects a new project that is not the owner’s with 422', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow({ ...stored, projectId: null }));
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		expect(await rejection(updateNote(prisma, TEST_USER_ID, ID, { projectId: PROJECT_ID }))).toMatchObject({ status: 422 });
		expect(prisma.note.updateMany).not.toHaveBeenCalled();
	});
});

describe('deleteNote', () => {
	it('deletes scoped by owner and removes the attachment files', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.attachment.findMany).mockResolvedValue(asRow([{ storagePath: 'u/1/file' }]));
		vi.mocked(prisma.note.deleteMany).mockResolvedValue({ count: 1 });
		await deleteNote(prisma, storage, TEST_USER_ID, ID);
		expect(prisma.attachment.findMany).toHaveBeenCalledWith({ select: { storagePath: true }, where: { noteId: ID, ownerId: TEST_USER_ID } });
		expect(prisma.note.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
		expect(storage.remove).toHaveBeenCalledWith('private', ['u/1/file']);
	});

	it('throws 404 for another owner and removes nothing', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);
		vi.mocked(prisma.note.deleteMany).mockResolvedValue({ count: 0 });
		expect(await rejection(deleteNote(prisma, storage, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(storage.remove).not.toHaveBeenCalled();
	});
});

describe('restoreRevision', () => {
	const REVISION_ID = '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b';
	const setup = () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.noteRevision.findFirst).mockResolvedValue(asRow({ body: 'old body', id: REVISION_ID, noteId: ID, title: 'Old title' }));
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow({ ...row, body: 'current body', title: 'Current' }));
		vi.mocked(prisma.note.updateMany).mockResolvedValue({ count: 1 });
		vi.mocked(prisma.noteRevision.findMany).mockResolvedValue([]);
		return prisma;
	};

	it('applies the revision as a normal edit that saves what it replaces', async () => {
		const prisma = setup();
		await restoreRevision(prisma, TEST_USER_ID, ID, REVISION_ID);
		expect(prisma.noteRevision.create).toHaveBeenCalledWith({ data: { body: 'current body', noteId: ID, ownerId: TEST_USER_ID, title: 'Current' } });
		expect(prisma.note.updateMany).toHaveBeenCalledWith({ data: { body: 'old body', title: 'Old title' }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.noteRevision.deleteMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: REVISION_ID } }));
	});

	it('changes nothing when the revision equals the current version', async () => {
		const prisma = setup();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow({ ...row, body: 'old body', title: 'Old title' }));
		await restoreRevision(prisma, TEST_USER_ID, ID, REVISION_ID);
		expect(prisma.noteRevision.create).not.toHaveBeenCalled();
		expect(prisma.note.updateMany).not.toHaveBeenCalled();
	});

	it('throws 404 when the revision is not found for that owner and note', async () => {
		const prisma = setup();
		vi.mocked(prisma.noteRevision.findFirst).mockResolvedValue(null);
		expect(await rejection(restoreRevision(prisma, OTHER_USER_ID, ID, REVISION_ID))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.note.updateMany).not.toHaveBeenCalled();
	});
});
