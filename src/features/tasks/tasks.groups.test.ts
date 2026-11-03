import { describe, expect, it } from 'vitest';
import { dueBucketWhere, sliceGroups, taskToday, weekEnd } from './tasks.groups.js';

const group = (key: string, count: number) => ({ count, key, where: {} });

describe('task day boundaries', () => {
	it('takes today from the calendar day it is in the given time zone, whatever the time of day', () => {
		expect(taskToday(new Date('2026-11-10T00:00:00Z'), 'UTC')).toEqual(new Date('2026-11-10'));
		expect(taskToday(new Date('2026-11-10T23:59:59Z'), 'UTC')).toEqual(new Date('2026-11-10'));
	});

	// Regression (#138): around midnight UTC a user west of UTC is still on the previous day, and one east of it is already on the next.
	it('is still yesterday for a user west of UTC just after midnight UTC', () => {
		expect(taskToday(new Date('2026-11-10T02:30:00Z'), 'America/Lima')).toEqual(new Date('2026-11-09'));
		expect(taskToday(new Date('2026-11-10T04:59:59Z'), 'America/Lima')).toEqual(new Date('2026-11-09'));
		expect(taskToday(new Date('2026-11-10T05:00:00Z'), 'America/Lima')).toEqual(new Date('2026-11-10'));
	});

	it('is already tomorrow for a user east of UTC before midnight UTC', () => {
		expect(taskToday(new Date('2026-11-10T20:00:00Z'), 'Pacific/Auckland')).toEqual(new Date('2026-11-11'));
	});

	it('closes "this week" six days after today (seven days, today included)', () => {
		expect(weekEnd(new Date('2026-11-10'))).toEqual(new Date('2026-11-16'));
	});
});

describe('dueBucketWhere', () => {
	const today = new Date('2026-11-10');

	it('only open tasks are overdue', () => {
		expect(dueBucketWhere('overdue', today)).toEqual({ dueDate: { lt: today }, status: { in: ['todo', 'in_progress'] } });
	});

	it('today and the week hold tasks of any status', () => {
		expect(dueBucketWhere('today', today)).toEqual({ dueDate: today });
		expect(dueBucketWhere('week', today)).toEqual({ dueDate: { gt: today, lte: new Date('2026-11-16') } });
	});

	it('later also holds the finished tasks that were due in the past', () => {
		expect(dueBucketWhere('later', today)).toEqual({ OR: [{ dueDate: { gt: new Date('2026-11-16') } }, { dueDate: { lt: today }, status: { in: ['done', 'cancelled'] } }] });
	});

	it('none is the tasks without a due date', () => {
		expect(dueBucketWhere('none', today)).toEqual({ dueDate: null });
	});
});

describe('sliceGroups', () => {
	const plan = [group('a', 3), group('b', 2), group('c', 5)];

	it('takes the first rows of the first groups', () => {
		expect(sliceGroups(plan, { page: 1, pageSize: 4 }).map(({ key, skip, take }) => [key, skip, take])).toEqual([
			['a', 0, 3],
			['b', 0, 1],
		]);
	});

	it('continues a group on the next page', () => {
		expect(sliceGroups(plan, { page: 2, pageSize: 4 }).map(({ key, skip, take }) => [key, skip, take])).toEqual([
			['b', 1, 1],
			['c', 0, 3],
		]);
		expect(sliceGroups(plan, { page: 3, pageSize: 4 }).map(({ key, skip, take }) => [key, skip, take])).toEqual([['c', 3, 2]]);
	});

	it('is empty past the last page', () => {
		expect(sliceGroups(plan, { page: 4, pageSize: 4 })).toEqual([]);
	});
});
