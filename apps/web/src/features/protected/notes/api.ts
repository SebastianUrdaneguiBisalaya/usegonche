import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { type Data, unwrap } from '~/lib/api-error';
import { type OkBody, PAGE_SIZE, unwrapPage } from '../shared/paged';
import { putToStorage } from '../shared/storage-upload';
import type { NotesParams } from './search-params';

type NotesResponse = Awaited<ReturnType<typeof api.notes.$get>>;
type NoteResponse = Awaited<ReturnType<(typeof api.notes)[':id']['$get']>>;
type RevisionsResponse = Awaited<ReturnType<(typeof api.notes)[':id']['revisions']['$get']>>;
type SearchResponse = Awaited<ReturnType<typeof api.search.$get>>;
type AttachmentsResponse = Awaited<ReturnType<typeof api.attachments.$get>>;

/** One page of `GET /notes`: the summaries (title, excerpt, tags, linked task ids) and the page meta. */
export type NotesPage = OkBody<NotesResponse>;
export type NoteSummary = NotesPage['data'][number];
/** One note with its body, as `GET /notes/:id` answers. */
export type Note = Data<NoteResponse>;
export type NoteRevision = OkBody<RevisionsResponse>['data'][number];
export type NoteSearchPage = OkBody<SearchResponse>;
export type NoteAttachment = OkBody<AttachmentsResponse>['data'][number];

export type CreateNoteBody = Body<typeof api.notes.$post>;
export type UpdateNoteBody = Body<(typeof api.notes)[':id']['$patch']>;

export const notesKey = (params: NotesParams) => ['notes', 'list', params] as const;

export function useNotes(params: NotesParams, enabled: boolean) {
	const { page, project, tag, task } = params;
	return useQuery({
		enabled,
		placeholderData: keepPreviousData,
		queryFn: () =>
			unwrapPage(
				api.notes.$get({ query: { page: String(page), pageSize: String(PAGE_SIZE), ...(project && { projectId: project }), ...(tag && { tagId: tag }), ...(task && { taskId: task }) } })
			),
		queryKey: notesKey(params),
	});
}

/** What `GET /search?types=note` found (title and a snippet with the matched words between « and »). */
export function useNotesSearch(q: string, page: number) {
	return useQuery({
		enabled: q.length > 0,
		placeholderData: keepPreviousData,
		queryFn: () => unwrapPage(api.search.$get({ query: { page: String(page), pageSize: String(PAGE_SIZE), q, types: 'note' } })),
		queryKey: ['notes', 'search', { page, q }] as const,
	});
}

export function useNote(id: string | undefined) {
	return useQuery({ enabled: id !== undefined && id !== '', queryFn: () => unwrap(api.notes[':id'].$get({ param: { id: id ?? '' } })), queryKey: ['notes', 'one', id] });
}

/** Everything that shows notes refetches after a change (lists, the open note, the notes listed in a task or a project). */
const refresh = (queryClient: QueryClient) =>
	Promise.all([
		queryClient.invalidateQueries({ queryKey: ['notes'] }),
		queryClient.invalidateQueries({ queryKey: ['tasks', 'notes'] }),
		queryClient.invalidateQueries({ queryKey: ['project-notes'] }),
	]);

export function useCreateNote() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (json: CreateNoteBody) => unwrap(api.notes.$post({ json })),
		onSuccess: note => {
			queryClient.setQueryData(['notes', 'one', note.id], note);
			return refresh(queryClient);
		},
	});
}

export function useUpdateNote() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ changes, id }: { changes: UpdateNoteBody; id: string }) => unwrap(api.notes[':id'].$patch({ json: changes, param: { id } })),
		onSuccess: note => {
			queryClient.setQueryData(['notes', 'one', note.id], note);
			return refresh(queryClient);
		},
	});
}

export function useDeleteNote() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => unwrap(api.notes[':id'].$delete({ param: { id } })),
		onSuccess: (_, id) => {
			queryClient.removeQueries({ queryKey: ['notes', 'one', id] });
			return refresh(queryClient);
		},
	});
}

/** Revisions of a note (the versions replaced by an edit of its title or body), newest first. */
export function useRevisions(noteId: string, enabled: boolean) {
	return useQuery({
		enabled,
		queryFn: () => unwrapPage(api.notes[':id'].revisions.$get({ param: { id: noteId }, query: { pageSize: '50' } })),
		queryKey: ['notes', 'revisions', noteId],
	});
}

export function useRevision(noteId: string, revisionId: string | undefined) {
	return useQuery({
		enabled: revisionId !== undefined,
		queryFn: () => unwrap(api.notes[':id'].revisions[':revisionId'].$get({ param: { id: noteId, revisionId: revisionId ?? '' } })),
		queryKey: ['notes', 'revision', noteId, revisionId],
	});
}

/** Restoring is a normal edit: the note answers with its new content, and what it replaced becomes a new revision. */
export function useRestoreRevision() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, revisionId }: { id: string; revisionId: string }) => unwrap(api.notes[':id'].revisions[':revisionId'].restore.$post({ param: { id, revisionId } })),
		onSuccess: note => {
			queryClient.setQueryData(['notes', 'one', note.id], note);
			return Promise.all([refresh(queryClient), queryClient.invalidateQueries({ queryKey: ['notes', 'revisions', note.id] })]);
		},
	});
}

export function useNoteFiles(noteId: string, enabled = true) {
	return useQuery({ enabled, queryFn: () => unwrap(api.attachments.$get({ query: { noteId, pageSize: '100' } })), queryKey: ['notes', 'files', noteId] });
}

type UploadBody = Body<(typeof api.attachments)['upload-url']['$post']>;

/**
 * The three steps of an upload: a signed URL from the API, the file straight to Storage, then its metadata is recorded. Resolves with a
 * signed read URL (what the dropzone previews) and the attachment id, so the file can be removed later.
 */
export async function uploadNoteFile(noteId: string, file: File, onProgress: (percent: number) => void): Promise<{ id: string; url: string }> {
	const mimeType = (file.type || 'application/octet-stream') as UploadBody['mimeType'];
	const upload = await unwrap(api.attachments['upload-url'].$post({ json: { mimeType, noteId, sizeBytes: file.size } }));
	await putToStorage(upload.uploadUrl, file, onProgress);
	const attachment = await unwrap(api.attachments.$post({ json: { mimeType, name: file.name, noteId, path: upload.path, sizeBytes: file.size } }));
	const { url } = await unwrap(api.attachments[':id'].url.$get({ param: { id: attachment.id } }));
	return { id: attachment.id, url };
}

export function useDeleteNoteFile(noteId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => unwrap(api.attachments[':id'].$delete({ param: { id } })),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', 'files', noteId] }),
	});
}

/** A fresh signed URL to download a file (the private bucket's links expire). */
export const noteFileUrl = (id: string) => unwrap(api.attachments[':id'].url.$get({ param: { id } }));

export const refreshNoteFiles = (queryClient: QueryClient, noteId: string) => queryClient.invalidateQueries({ queryKey: ['notes', 'files', noteId] });
