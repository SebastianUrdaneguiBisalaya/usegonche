import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, TEST_USER_ID } from '../../test/helpers.js';
import { previousRange, ratio, resolveRange, taskWhere, viaTask } from './metrics.shared.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);
const setup = (timezone: string | null = null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(timezone ? ({ timezone } as never) : null);
	return prisma;
};

describe('ratio', () => {
	it('keeps the counts and rounds the rate', () => {
		expect(ratio(1, 3)).toEqual({ done: 1, rate: 0.333, total: 3 });
		expect(ratio(2, 2)).toEqual({ done: 2, rate: 1, total: 2 });
	});

	it('has no rate when there is nothing to divide', () => {
		expect(ratio(0, 0)).toEqual({ done: 0, rate: null, total: 0 });
	});
});

describe('resolveRange', () => {
	it('defaults to the last 30 days up to today in UTC', async () => {
		const range = await resolveRange(setup(), TEST_USER_ID, {}, NOW);
		expect(range).toMatchObject({ from: '2026-10-12', timeZone: 'UTC', to: '2026-11-10' });
		expect(range.start).toEqual(new Date('2026-10-12T00:00:00Z'));
		expect(range.end).toEqual(new Date('2026-11-11T00:00:00Z'));
	});

	it('uses the timezone of the user for today and for the day boundaries', async () => {
		const range = await resolveRange(setup('Pacific/Auckland'), TEST_USER_ID, { from: '2026-11-10' }, new Date('2026-11-09T20:00:00Z'));
		expect(range).toMatchObject({ from: '2026-11-10', timeZone: 'Pacific/Auckland', to: '2026-11-10' });
		expect(range.start).toEqual(new Date('2026-11-09T11:00:00Z'));
	});

	it('answers 422 for a reversed range and for more than 366 days', async () => {
		expect(await rejection(resolveRange(setup(), TEST_USER_ID, { from: '2026-11-10', to: '2026-11-01' }, NOW))).toMatchObject({ details: [{ code: 'from_after_to', field: 'from' }], status: 422 });
		expect(await rejection(resolveRange(setup(), TEST_USER_ID, { from: '2025-01-01', to: '2026-11-10' }, NOW))).toMatchObject({
			details: [{ code: 'range_too_large', field: 'from' }],
			status: 422,
		});
		expect((await resolveRange(setup(), TEST_USER_ID, { from: '2025-11-10', to: '2026-11-10' }, NOW)).from).toBe('2025-11-10');
	});
});

describe('previousRange', () => {
	it('is the same length and ends the day before', async () => {
		const range = await resolveRange(setup(), TEST_USER_ID, { from: '2026-11-01', to: '2026-11-10' }, NOW);
		const previous = previousRange(range);
		expect(previous).toMatchObject({ from: '2026-10-22', to: '2026-10-31' });
		expect(previous.start).toEqual(new Date('2026-10-22T00:00:00Z'));
		expect(previous.end).toEqual(range.start);
	});
});

describe('task filters', () => {
	it('builds the task where only from the filters that are set', () => {
		expect(taskWhere({})).toEqual({});
		expect(taskWhere({ goalId: 'g', priority: 'high', projectId: 'p', tagId: 't' })).toEqual({ goalId: 'g', priority: 'high', projectId: 'p', tags: { some: { tagId: 't' } } });
	});

	it('goes through the task relation only when filtering', () => {
		expect(viaTask({})).toEqual({});
		expect(viaTask({ projectId: 'p' })).toEqual({ task: { projectId: 'p' } });
	});
});
