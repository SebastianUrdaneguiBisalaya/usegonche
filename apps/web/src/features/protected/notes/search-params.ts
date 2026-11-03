import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';

/** The list next to the editor, or a grid of cards (the editor then opens in a drawer). */
export const noteViews = ['list', 'grid'] as const;
export type NoteView = (typeof noteViews)[number];

/** Everything the notes page keeps in the URL, so a reload, a shared link or the back button restore the same view (and the open note). */
export const noteParsers = {
	note: parseAsString.withDefault(''),
	page: parseAsInteger.withDefault(1),
	project: parseAsString.withDefault(''),
	/** Text typed in the search box: only narrows the notes already loaded, it never reaches the API. */
	q: parseAsString.withDefault(''),
	tag: parseAsString.withDefault(''),
	task: parseAsString.withDefault(''),
	view: parseAsStringLiteral(noteViews).withDefault('list'),
};

export const loadNoteParams = createLoader(noteParsers);

export interface NotesParams {
	page: number;
	project: string;
	tag: string;
	task: string;
}
