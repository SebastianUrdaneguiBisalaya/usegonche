import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { getRevision, listRevisions, MAX_REVISIONS, recordRevision } from './notes.revisions.service.js';

const NOTE_ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const REVISION_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const note = { body: '{"type":"doc"}', id: NOTE_ID, title: 'Meeting' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('recordRevision', () => {
	it('saves the given title and body for the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.noteRevision.findMany).mockResolvedValue([]);
		await recordRevision(prisma, TEST_USER_ID, note);
		expect(prisma.noteRevision.create).toHaveBeenCalledWith({ data: { body: note.body, noteId: NOTE_ID, ownerId: TEST_USER_ID, title: 'Meeting' } });
		expect(prisma.noteRevision.deleteMany).not.toHaveBeenCalled();
	});

	it('deletes the revisions beyond the latest 50 of that note only', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.noteRevision.findMany).mockResolvedValue(asRow([{ id: 'old-1' }, { id: 'old-2' }]));
		await recordRevision(prisma, TEST_USER_ID, note);
		expect(MAX_REVISIONS).toBe(50);
		expect(prisma.noteRevision.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true }, skip: 50, where: { noteId: NOTE_ID, ownerId: TEST_USER_ID } }));
		expect(prisma.noteRevision.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old-1', 'old-2'] }, ownerId: TEST_USER_ID } });
	});
});

describe('listRevisions', () => {
	it('omits the body and scopes by owner and note', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(asRow({ id: NOTE_ID }));
		vi.mocked(prisma.noteRevision.findMany).mockResolvedValue(asRow([{ id: REVISION_ID }]));
		expect(await listRevisions(prisma, TEST_USER_ID, NOTE_ID, 20)).toHaveLength(1);
		expect(prisma.noteRevision.findMany).toHaveBeenCalledWith(expect.objectContaining({ omit: { body: true }, take: 21, where: { noteId: NOTE_ID, ownerId: TEST_USER_ID } }));
	});

	it('throws 404 when the note is not the owner’s', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
		expect(await rejection(listRevisions(prisma, OTHER_USER_ID, NOTE_ID, 20))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.noteRevision.findMany).not.toHaveBeenCalled();
	});
});

describe('getRevision', () => {
	it('returns the revision scoped by owner and note', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.noteRevision.findFirst).mockResolvedValue(asRow({ id: REVISION_ID }));
		expect(await getRevision(prisma, TEST_USER_ID, NOTE_ID, REVISION_ID)).toEqual({ id: REVISION_ID });
		expect(vi.mocked(prisma.noteRevision.findFirst).mock.calls[0]?.[0]?.where).toEqual({ id: REVISION_ID, noteId: NOTE_ID, ownerId: TEST_USER_ID });
	});

	it('throws 404 when it does not exist or belongs to another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.noteRevision.findFirst).mockResolvedValue(null);
		expect(await rejection(getRevision(prisma, OTHER_USER_ID, NOTE_ID, REVISION_ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});
