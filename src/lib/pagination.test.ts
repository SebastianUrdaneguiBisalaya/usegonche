import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cursorSchema, decodeCursor, encodeCursor, keysetAfter, keysetOrder, LIMIT_DEFAULT, LIMIT_MAX, paginationQuery, toPage } from './pagination.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const AT = new Date('2026-11-01T15:00:00.123Z');
const query = z.object(paginationQuery);

describe('cursor encoding', () => {
	it('round-trips and is URL safe', () => {
		const encoded = encodeCursor({ at: AT, id: ID });
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeCursor(encoded)).toEqual({ at: AT, id: ID });
	});

	it.each([
		['empty', ''],
		['garbage', '%%%'],
		['not base64 of a cursor', btoa('hello')],
		['bad date', btoa(`nope|${ID}`)],
		['bad id', btoa(`${AT.toISOString()}|123`)],
		['extra parts', btoa(`${AT.toISOString()}|${ID}|x`)],
		['non-canonical date', btoa(`2026-11-01|${ID}`)],
	])('rejects %s', (_label, value) => {
		expect(decodeCursor(value)).toBeNull();
	});
});

describe('paginationQuery', () => {
	it('defaults the limit, coerces strings and decodes the cursor', () => {
		expect(query.parse({})).toEqual({ limit: LIMIT_DEFAULT });
		expect(query.parse({ cursor: encodeCursor({ at: AT, id: ID }), limit: '10' })).toEqual({ cursor: { at: AT, id: ID }, limit: 10 });
	});

	it.each([
		['limit 0', { limit: '0' }],
		['limit over max', { limit: String(LIMIT_MAX + 1) }],
		['invalid cursor', { cursor: 'nope' }],
	])('rejects %s', (_label, input) => {
		expect(query.safeParse(input).success).toBe(false);
	});

	it('exposes the cursor schema on its own', () => {
		expect(cursorSchema.safeParse(encodeCursor({ at: AT, id: ID })).success).toBe(true);
	});
});

describe('keyset helpers', () => {
	it('orders by the field then id, both descending', () => {
		expect(keysetOrder('capturedAt')).toEqual([{ capturedAt: 'desc' }, { id: 'desc' }]);
	});

	it('adds nothing without a cursor', () => {
		expect(keysetAfter('capturedAt', undefined)).toEqual({});
	});

	it('selects rows strictly after the cursor, breaking ties by id', () => {
		expect(keysetAfter('capturedAt', { at: AT, id: ID })).toEqual({ OR: [{ capturedAt: { lt: AT } }, { capturedAt: AT, id: { lt: ID } }] });
	});
});

describe('toPage', () => {
	const row = (n: number) => ({ at: new Date(2026, 0, n), id: `${ID.slice(0, -1)}${n}` });

	it('returns every row and no cursor on the last page', () => {
		const rows = [row(3), row(2)];
		expect(toPage(rows, 3, r => r.at)).toEqual({ items: rows, nextCursor: null });
	});

	it('also has no cursor when the page is exactly full', () => {
		expect(toPage([row(2), row(1)], 2, r => r.at).nextCursor).toBeNull();
	});

	it('drops the extra row and points the cursor at the last kept one', () => {
		const rows = [row(3), row(2), row(1)];
		const page = toPage(rows, 2, r => r.at);
		expect(page.items).toEqual([row(3), row(2)]);
		expect(decodeCursor(page.nextCursor ?? '')).toEqual({ at: row(2).at, id: row(2).id });
	});

	it('handles an empty result', () => {
		expect(toPage([], 5, () => AT)).toEqual({ items: [], nextCursor: null });
	});
});
