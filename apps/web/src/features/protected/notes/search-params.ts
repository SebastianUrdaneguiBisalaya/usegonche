import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';

/** Everything the notes page keeps in the URL, so a reload, a shared link or the back button restore the same view (and the open note). */
export const noteParsers = {
	note: parseAsString.withDefault(''),
	page: parseAsInteger.withDefault(1),
	project: parseAsString.withDefault(''),
	/** Text typed in the search box: only narrows the notes already loaded, it never reaches the API. */
	q: parseAsString.withDefault(''),
	tag: parseAsString.withDefault(''),
	task: parseAsString.withDefault(''),
};

export const loadNoteParams = createLoader(noteParsers);

export interface NotesParams {
	page: number;
	project: string;
	tag: string;
	task: string;
}
