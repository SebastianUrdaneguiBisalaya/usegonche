import { describe, expect, it } from 'vitest';
import { RICH_TEXT_MAX, richTextSchema } from './rich-text.js';

describe('richTextSchema', () => {
	it('accepts serialized JSON', () => {
		expect(richTextSchema.safeParse('{"type":"doc","content":[]}').success).toBe(true);
	});

	it('rejects text that is not JSON', () => {
		expect(richTextSchema.safeParse('<p>hi</p>').success).toBe(false);
	});

	it('rejects values over the size limit', () => {
		expect(richTextSchema.safeParse(JSON.stringify('x'.repeat(RICH_TEXT_MAX))).success).toBe(false);
	});
});
