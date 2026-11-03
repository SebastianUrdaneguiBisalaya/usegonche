/** Two initials of the name: first letters of the first two words, or the first two letters of a single word (an email prefix too). */
export function initialsOf(name: string): string {
	const words = name.split(/[\s._-]+/).filter(Boolean);
	const letters = words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : (words[0] ?? '').slice(0, 2);
	return letters.toUpperCase();
}
