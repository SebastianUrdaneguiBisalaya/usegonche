import type { Note, NoteRevision, Prisma, PrismaClient } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** Revisions kept per note; older ones are deleted when a new one is written. */
export const MAX_REVISIONS = 50;

/** Lists omit the body (it can be large); fetch the revision to read it. */
export type RevisionSummary = Omit<NoteRevision, 'body'>;

/**
 * Saves the title and body a note has right now, to be called inside the transaction of the edit that changes them.
 * Keeps only the latest `MAX_REVISIONS` per note.
 */
export const recordRevision = async (tx: Db, ownerId: string, note: Pick<Note, 'body' | 'id' | 'title'>): Promise<void> => {
	await tx.noteRevision.create({ data: { body: note.body, noteId: note.id, ownerId, title: note.title } });
	const stale = await tx.noteRevision.findMany({ orderBy: pageOrder('createdAt'), select: { id: true }, skip: MAX_REVISIONS, where: scoped(ownerId, { noteId: note.id }) });
	if (stale.length > 0) await tx.noteRevision.deleteMany({ where: scoped(ownerId, { id: { in: stale.map(revision => revision.id) } }) });
};

const assertNote = async (prisma: Db, ownerId: string, noteId: string): Promise<void> => {
	if (!(await prisma.note.findFirst({ select: { id: true }, where: scoped(ownerId, { id: noteId }) }))) throw new AppError('not_found', 404);
};

/** One page of revisions of the note (newest first) with the total. */
export const listRevisions = async (prisma: PrismaClient, ownerId: string, noteId: string, page: PageParams): Promise<Paged<RevisionSummary>> => {
	await assertNote(prisma, ownerId, noteId);
	const where = scoped(ownerId, { noteId });
	const [items, total] = await Promise.all([prisma.noteRevision.findMany({ omit: { body: true }, orderBy: pageOrder('createdAt'), ...pageArgs(page), where }), prisma.noteRevision.count({ where })]);
	return { items, total };
};

export const getRevision = async (prisma: Db, ownerId: string, noteId: string, revisionId: string): Promise<NoteRevision> => {
	const revision = await prisma.noteRevision.findFirst({ where: scoped(ownerId, { id: revisionId, noteId }) });
	if (!revision) throw new AppError('not_found', 404);
	return revision;
};
