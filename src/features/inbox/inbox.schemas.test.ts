import { describe, expect, it } from 'vitest';
import { BRAIN_DUMP_MAX_ITEMS, brainDumpSchema, CONTENT_MAX, listQuerySchema, setStatusSchema, splitLines } from './inbox.schemas.js';

describe('splitLines', () => {
	it('splits on any newline, trims and drops blank lines', () => {
		expect(splitLines('  a \r\n\n b\n   \nc')).toEqual(['a', 'b', 'c']);
	});
});

describe('brainDumpSchema', () => {
	it('turns the text into one entry per line', () => {
		expect(brainDumpSchema.parse({ text: 'a\nb' }).text).toEqual(['a', 'b']);
	});

	it.each([
		['only blank lines', '  \n \n'],
		['too many lines', Array.from({ length: BRAIN_DUMP_MAX_ITEMS + 1 }, (_, i) => `t${i}`).join('\n')],
		['a too long line', 'x'.repeat(CONTENT_MAX + 1)],
	])('rejects %s', (_label, text) => {
		expect(brainDumpSchema.safeParse({ text }).success).toBe(false);
	});
});

describe('setStatusSchema', () => {
	it('does not allow setting converted', () => {
		expect(setStatusSchema.safeParse({ status: 'converted' }).success).toBe(false);
		expect(setStatusSchema.safeParse({ status: 'archived' }).success).toBe(true);
	});
});

describe('listQuerySchema', () => {
	it('defaults to pending items and a sane limit, and coerces strings', () => {
		expect(listQuerySchema.parse({})).toEqual({ limit: 50, status: 'pending' });
		expect(listQuerySchema.parse({ limit: '10', status: 'archived' })).toEqual({ limit: 10, status: 'archived' });
	});

	it('rejects limits out of range', () => {
		expect(listQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
		expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
	});
});
