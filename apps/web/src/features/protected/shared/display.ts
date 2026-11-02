/** Small stable hash of a text, to derive a look (icon, color) from an id or a name. */
export const hash = (text: string): number => {
	let value = 0;
	for (const char of text) value = (value * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
	return value;
};

/** Picks an item of a list from a text, always the same one for the same text. */
export const pickBy = <T>(items: readonly T[], text: string, fallback: T): T => items[hash(text) % items.length] ?? fallback;

/** Markdown reduced to plain text for a one-line preview (headings, emphasis, links and list markers dropped). */
export const plainText = (markdown: string | null): string =>
	(markdown ?? '')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[`*_~>#]+/g, '')
		.replace(/^\s*[-+]\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
