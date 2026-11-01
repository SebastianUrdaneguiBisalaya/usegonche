import { describe, expect, it } from 'vitest';
import { scoped } from './owner.js';

describe('scoped', () => {
	it('adds the owner to an empty where', () => {
		expect(scoped('user-1')).toEqual({ ownerId: 'user-1' });
	});

	it('keeps the original filters', () => {
		expect(scoped('user-1', { name: 'work' })).toEqual({ name: 'work', ownerId: 'user-1' });
	});

	it('cannot be overridden by the where clause', () => {
		expect(scoped('user-1', { ownerId: 'user-2' } as object)).toEqual({ ownerId: 'user-1' });
	});

	it('does not mutate the input', () => {
		const where = { name: 'work' };
		scoped('user-1', where);
		expect(where).toEqual({ name: 'work' });
	});
});
