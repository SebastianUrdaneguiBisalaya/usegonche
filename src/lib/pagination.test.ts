import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, pageArgs, pageMeta, pageOrder, paginationQuery } from './pagination.js';

const query = z.object(paginationQuery);

describe('paginationQuery', () => {
	it('defaults to the first page and coerces strings', () => {
		expect(query.parse({})).toEqual({ page: 1, pageSize: PAGE_SIZE_DEFAULT });
		expect(query.parse({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10 });
	});

	it.each([
		['page 0', { page: '0' }],
		['negative page', { page: '-1' }],
		['fractional page', { page: '1.5' }],
		['pageSize 0', { pageSize: '0' }],
		['pageSize over max', { pageSize: String(PAGE_SIZE_MAX + 1) }],
	])('rejects %s', (_label, input) => {
		expect(query.safeParse(input).success).toBe(false);
	});
});

describe('page helpers', () => {
	it('orders by the field then id, both descending', () => {
		expect(pageOrder('capturedAt')).toEqual([{ capturedAt: 'desc' }, { id: 'desc' }]);
	});

	it('skips the rows of the previous pages', () => {
		expect(pageArgs({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
		expect(pageArgs({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
	});

	it('builds the meta with a page count of at least 1', () => {
		expect(pageMeta({ page: 2, pageSize: 20 }, 45)).toEqual({ page: 2, pageCount: 3, pageSize: 20, total: 45 });
		expect(pageMeta({ page: 1, pageSize: 20 }, 40)).toEqual({ page: 1, pageCount: 2, pageSize: 20, total: 40 });
		expect(pageMeta({ page: 1, pageSize: 20 }, 0)).toEqual({ page: 1, pageCount: 1, pageSize: 20, total: 0 });
	});
});
