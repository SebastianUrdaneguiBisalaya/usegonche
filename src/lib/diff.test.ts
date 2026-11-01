import { describe, expect, it } from 'vitest';
import { changedFields, hasChanges, valuesEqual } from './diff.js';

describe('hasChanges', () => {
	it('is true only for objects with keys', () => {
		expect(hasChanges({})).toBe(false);
		expect(hasChanges({ a: undefined })).toBe(true);
		expect(hasChanges({ a: 1 })).toBe(true);
	});
});

describe('valuesEqual', () => {
	it('compares primitives', () => {
		expect(valuesEqual('a', 'a')).toBe(true);
		expect(valuesEqual('a', 'b')).toBe(false);
		expect(valuesEqual(1, 1)).toBe(true);
		expect(valuesEqual(1, '1')).toBe(false);
		expect(valuesEqual(false, 0)).toBe(false);
		expect(valuesEqual(Number.NaN, Number.NaN)).toBe(true);
	});

	it('treats null and undefined as the same "no value", but not as 0 or empty string', () => {
		expect(valuesEqual(null, undefined)).toBe(true);
		expect(valuesEqual(undefined, undefined)).toBe(true);
		expect(valuesEqual(null, 0)).toBe(false);
		expect(valuesEqual('', null)).toBe(false);
	});

	it('compares dates by time, not identity', () => {
		expect(valuesEqual(new Date('2026-11-02'), new Date('2026-11-02T00:00:00.000Z'))).toBe(true);
		expect(valuesEqual(new Date('2026-11-02'), new Date('2026-11-03'))).toBe(false);
		expect(valuesEqual(new Date('2026-11-02'), '2026-11-02')).toBe(false);
		expect(valuesEqual(new Date('2026-11-02'), null)).toBe(false);
	});

	it('compares arrays in order by default and as sets when unordered', () => {
		expect(valuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
		expect(valuesEqual(['a', 'b'], ['b', 'a'])).toBe(false);
		expect(valuesEqual(['a', 'b'], ['b', 'a'], true)).toBe(true);
		expect(valuesEqual(['a', 'a', 'b'], ['a', 'b', 'b'], true)).toBe(false);
		expect(valuesEqual(['a'], ['a', 'b'], true)).toBe(false);
		expect(valuesEqual([], [], true)).toBe(true);
		expect(valuesEqual(['a'], 'a')).toBe(false);
	});

	it('compares plain objects recursively, also inside arrays', () => {
		expect(valuesEqual({ a: 1, b: { c: new Date('2026-11-02') } }, { b: { c: new Date('2026-11-02') }, a: 1 })).toBe(true);
		expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
		expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		expect(valuesEqual({ a: 1 }, { a: 1, b: null })).toBe(true);
		expect(
			valuesEqual(
				[
					{ end: 2, start: 1 },
					{ end: 4, start: 3 },
				],
				[
					{ end: 4, start: 3 },
					{ end: 2, start: 1 },
				],
				true
			)
		).toBe(true);
	});
});

describe('changedFields', () => {
	const stored = { description: null, dueDate: new Date('2026-11-10'), tagIds: ['a', 'b'], title: 'Write' };

	it('returns nothing when the patch matches the stored values', () => {
		expect(changedFields(stored, { dueDate: new Date('2026-11-10'), title: 'Write' })).toEqual({});
	});

	it('returns only the fields that differ', () => {
		expect(changedFields(stored, { dueDate: new Date('2026-11-10'), title: 'New' })).toEqual({ title: 'New' });
	});

	it('ignores keys the patch does not carry or carries as undefined', () => {
		expect(changedFields(stored, { title: undefined })).toEqual({});
		expect(changedFields(stored, {})).toEqual({});
	});

	it('counts null only when the stored value is not already empty', () => {
		expect(changedFields(stored, { description: null })).toEqual({});
		expect(changedFields(stored, { dueDate: null })).toEqual({ dueDate: null });
		expect(changedFields({ ...stored, description: 'x' }, { description: null })).toEqual({ description: null });
	});

	it('treats a value set on a stored null as a change', () => {
		expect(changedFields(stored, { description: 'x' })).toEqual({ description: 'x' });
	});

	it('compares set-like keys without order only when listed as unordered', () => {
		expect(changedFields(stored, { tagIds: ['b', 'a'] })).toEqual({ tagIds: ['b', 'a'] });
		expect(changedFields(stored, { tagIds: ['b', 'a'] }, { unordered: ['tagIds'] })).toEqual({});
		expect(changedFields(stored, { tagIds: ['a'] }, { unordered: ['tagIds'] })).toEqual({ tagIds: ['a'] });
	});

	it('does not mutate its inputs', () => {
		const patch = { title: 'New' };
		changedFields(stored, patch);
		expect(patch).toEqual({ title: 'New' });
		expect(stored.title).toBe('Write');
	});
});
