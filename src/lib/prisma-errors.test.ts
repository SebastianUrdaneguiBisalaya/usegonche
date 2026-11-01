import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './prisma-errors.js';

describe('isUniqueViolation', () => {
	it('detects Prisma unique constraint errors', () => {
		expect(isUniqueViolation(Object.assign(new Error('x'), { code: 'P2002' }))).toBe(true);
	});

	it.each([[Object.assign(new Error('x'), { code: 'P2025' })], [new Error('x')], [null], [undefined], ['P2002']])('ignores other errors (%#)', error => {
		expect(isUniqueViolation(error)).toBe(false);
	});
});
