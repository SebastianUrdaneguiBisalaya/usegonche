import type { Note, Prisma, PrismaClient, Tag } from '@usegonche/database';
import type { Storage } from '@usegonche/storage';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Cursor, keysetAfter, keysetOrder } from '../../lib/pagination.js';
import { attachmentPaths, removeFiles } from '../attachments/attachments.service.js';
import { markConverted } from '../inbox/inbox.service.js';
import type { CreateNoteInput, ListNotesFilters, UpdateNoteInput } from './notes.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;

type Links = { tags: Tag[]; taskIds: string[] };
export type NoteView = Note & Links;
/** Lists omit the body (it can be large); fetch the note to read it. */
export type NoteSummary = Omit<Note, 'body'> & Links;

const include = {
	tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' as const } } },
	tasks: { select: { taskId: true } },
};
type Linked = { tags: { tag: Tag }[]; tasks: { taskId: string }[] };

const links = ({ tags, tasks }: Linked): Links => ({ tags: tags.map(link => link.tag), taskIds: tasks.map(link => link.taskId) });

const invalidReference = (field: string): AppError => new AppError('validation_error', 422, [{ code: 'not_found', field }]);

const assertProject = async (prisma: Db, ownerId: string, projectId: string): Promise<void> => {
	if (!(await prisma.project.findFirst({ select: { id: true }, where: scoped(ownerId, { id: projectId }) }))) throw invalidReference('projectId');
};

const assertTags = async (prisma: Db, ownerId: string, tagIds: string[]): Promise<void> => {
	if (tagIds.length > 0 && (await prisma.tag.count({ where: scoped(ownerId, { id: { in: tagIds } }) })) !== tagIds.length) throw invalidReference('tagIds');
};

const assertTasks = async (prisma: Db, ownerId: string, taskIds: string[]): Promise<void> => {
	if (taskIds.length > 0 && (await prisma.task.count({ where: scoped(ownerId, { id: { in: taskIds } }) })) !== taskIds.length) throw invalidReference('taskIds');
};

/** Fetches `limit + 1` rows after `cursor` (newest first); pass them to `toPage`. */
export const listNotes = async (prisma: PrismaClient, ownerId: string, filters: ListNotesFilters, limit: number, cursor?: Cursor): Promise<NoteSummary[]> => {
	const { projectId, tagId, taskId } = filters;
	const rows = await prisma.note.findMany({
		include,
		omit: { body: true },
		orderBy: keysetOrder('createdAt'),
		take: limit + 1,
		where: {
			...scoped(ownerId, { ...(projectId && { projectId }), ...(tagId && { tags: { some: { tagId } } }), ...(taskId && { tasks: { some: { taskId } } }) }),
			...keysetAfter('createdAt', cursor),
		},
	});
	return rows.map(({ tags, tasks, ...note }) => ({ ...note, ...links({ tags, tasks }) }));
};

export const getNote = async (prisma: Db, ownerId: string, id: string): Promise<NoteView> => {
	const row = await prisma.note.findFirst({ include, where: scoped(ownerId, { id }) });
	if (!row) throw new AppError('not_found', 404);
	const { tags, tasks, ...note } = row;
	return { ...note, ...links({ tags, tasks }) };
};

/** With `originInboxItemId` the inbox item is marked converted in the same transaction (404 if not the owner's, 409 if not pending). */
export const createNote = (prisma: PrismaClient, ownerId: string, input: CreateNoteInput): Promise<NoteView> =>
	prisma.$transaction(async tx => {
		if (input.projectId) await assertProject(tx, ownerId, input.projectId);
		await assertTags(tx, ownerId, input.tagIds);
		await assertTasks(tx, ownerId, input.taskIds);
		if (input.originInboxItemId) await markConverted(tx, ownerId, input.originInboxItemId);
		const { id } = await tx.note.create({
			data: {
				body: input.body,
				originInboxItemId: input.originInboxItemId,
				ownerId,
				projectId: input.projectId,
				tags: { create: input.tagIds.map(tagId => ({ tagId })) },
				tasks: { create: input.taskIds.map(taskId => ({ taskId })) },
				title: input.title,
			},
			select: { id: true },
		});
		return getNote(tx, ownerId, id);
	});

/** Writes only what changed (tags and tasks are compared as sets); an update that changes nothing answers with the current note and writes nothing. */
export const updateNote = (prisma: PrismaClient, ownerId: string, id: string, { tagIds, taskIds, ...fields }: UpdateNoteInput): Promise<NoteView> =>
	prisma.$transaction(async tx => {
		const current = await getNote(tx, ownerId, id);
		const {
			tagIds: newTagIds,
			taskIds: newTaskIds,
			...changes
		} = changedFields({ ...current, tagIds: current.tags.map(tag => tag.id) }, { ...fields, tagIds, taskIds }, { unordered: ['tagIds', 'taskIds'] });
		if (!hasChanges(changes) && !newTagIds && !newTaskIds) return current;

		if (changes.projectId) await assertProject(tx, ownerId, changes.projectId);
		if (newTagIds) await assertTags(tx, ownerId, newTagIds);
		if (newTaskIds) await assertTasks(tx, ownerId, newTaskIds);
		if (hasChanges(changes)) await tx.note.updateMany({ data: changes, where: scoped(ownerId, { id }) });
		if (newTagIds) {
			await tx.noteTag.deleteMany({ where: { noteId: id } });
			await tx.noteTag.createMany({ data: newTagIds.map(tagId => ({ noteId: id, tagId })) });
		}
		if (newTaskIds) {
			await tx.taskNote.deleteMany({ where: { noteId: id } });
			await tx.taskNote.createMany({ data: newTaskIds.map(taskId => ({ noteId: id, taskId })) });
		}
		return getNote(tx, ownerId, id);
	});

/** Deletes the note; tag/task links and attachment rows cascade, and the attachment files are removed from Storage. */
export const deleteNote = async (prisma: PrismaClient, storage: Storage, ownerId: string, id: string): Promise<void> => {
	const paths = await attachmentPaths(prisma, ownerId, { noteId: id });
	const { count } = await prisma.note.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
	await removeFiles(storage, paths);
};
