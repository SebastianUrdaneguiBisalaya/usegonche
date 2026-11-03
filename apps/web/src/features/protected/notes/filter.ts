import type { NoteSummary } from './api';

/** Lower case without accents, so "reunion" finds "Reunión". */
const normalize = (text: string): string =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLocaleLowerCase();

/** The notes of the loaded page whose title or body excerpt contain `query` (every word of it, in any order). All of them when the query is empty. No request is made. */
export function filterNotes(notes: readonly NoteSummary[], query: string): NoteSummary[] {
	const words = normalize(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return [...notes];
	return notes.filter(note => {
		const haystack = normalize(`${note.title} ${note.excerpt ?? ''}`);
		return words.every(word => haystack.includes(word));
	});
}
