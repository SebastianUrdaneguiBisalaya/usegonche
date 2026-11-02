import { describe, expect, it } from 'vitest';
import { MARKDOWN_MAX, markdownSchema } from './markdown.js';

describe('markdownSchema', () => {
	it('accepts Markdown, including an empty string', () => {
		expect(markdownSchema.safeParse('# Title\n\n- [ ] item **bold**').success).toBe(true);
		expect(markdownSchema.safeParse('').success).toBe(true);
	});

	it('rejects values over the size limit and non-strings', () => {
		expect(markdownSchema.safeParse('x'.repeat(MARKDOWN_MAX + 1)).success).toBe(false);
		expect(markdownSchema.safeParse(MARKDOWN_MAX).success).toBe(false);
	});

	it('accepts a value exactly at the limit', () => {
		expect(markdownSchema.safeParse('x'.repeat(MARKDOWN_MAX)).success).toBe(true);
	});
});
