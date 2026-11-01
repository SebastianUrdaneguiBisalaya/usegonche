import { z } from 'zod';

/** Max size of serialized TipTap JSON stored in a `text` column. */
export const RICH_TEXT_MAX = 100_000;

/** The API treats rich text as opaque: it only checks that it is bounded, parseable JSON. It never queries inside it. */
export const richTextSchema = z
	.string()
	.max(RICH_TEXT_MAX)
	.refine(value => {
		try {
			JSON.parse(value);
			return true;
		} catch {
			return false;
		}
	}, 'invalid_rich_text');
