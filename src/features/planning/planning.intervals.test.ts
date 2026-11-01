import { describe, expect, it } from 'vitest';
import { availabilityIntervals, busyIntervals, clip, datesTouched, merge, minutesOf, overlaps, subtract } from './planning.intervals.js';

const m = (minutes: number) => minutes * 60_000;
const iv = (start: number, end: number) => ({ end: m(end), start: m(start) });

describe('intervals', () => {
	it('detects overlaps as half-open ranges', () => {
		expect(overlaps(iv(0, 10), iv(5, 15))).toBe(true);
		expect(overlaps(iv(0, 10), iv(10, 20))).toBe(false);
	});

	it('merges touching and overlapping ranges', () => {
		expect(merge([iv(10, 20), iv(0, 10), iv(15, 25), iv(40, 50)])).toEqual([iv(0, 25), iv(40, 50)]);
	});

	it('subtracts ranges (middle, edges, full cover, no overlap)', () => {
		expect(subtract([iv(0, 100)], [iv(40, 60)])).toEqual([iv(0, 40), iv(60, 100)]);
		expect(subtract([iv(0, 100)], [iv(0, 30), iv(90, 120)])).toEqual([iv(30, 90)]);
		expect(subtract([iv(10, 20)], [iv(0, 100)])).toEqual([]);
		expect(subtract([iv(0, 10)], [iv(20, 30)])).toEqual([iv(0, 10)]);
	});

	it('clips to a range', () => {
		expect(clip(iv(0, 100), iv(50, 200))).toEqual(iv(50, 100));
		expect(clip(iv(0, 10), iv(20, 30))).toBeNull();
	});

	it('sums minutes', () => {
		expect(minutesOf([iv(0, 30), iv(60, 90)])).toBe(60);
	});
});

describe('availabilityIntervals', () => {
	const windows = [
		{ endMinute: 12 * 60, startMinute: 9 * 60, weekday: 1 },
		{ endMinute: 18 * 60, startMinute: 13 * 60, weekday: 1 },
		{ endMinute: 17 * 60, startMinute: 9 * 60, weekday: 2 },
	];

	it('applies the weekly template to each date in the user timezone', () => {
		// 2026-11-02 is a Monday; Lima is UTC-5
		const result = availabilityIntervals(windows, '2026-11-02', '2026-11-02', 'America/Lima');
		expect(result.map(i => [new Date(i.start).toISOString(), new Date(i.end).toISOString()])).toEqual([
			['2026-11-02T14:00:00.000Z', '2026-11-02T17:00:00.000Z'],
			['2026-11-02T18:00:00.000Z', '2026-11-02T23:00:00.000Z'],
		]);
		expect(minutesOf(result)).toBe(8 * 60);
	});

	it('covers several dates and skips weekdays without windows', () => {
		expect(minutesOf(availabilityIntervals(windows, '2026-11-02', '2026-11-04', 'UTC'))).toBe(8 * 60 + 8 * 60);
	});
});

describe('busyIntervals', () => {
	const base = { endsAt: new Date('2026-11-02T11:00:00Z'), startsAt: new Date('2026-11-02T10:00:00Z') };

	it('counts timed events and out-of-office, but not plain all-day events', () => {
		const result = busyIntervals([
			{ ...base, allDay: false, kind: 'event' },
			{ ...base, allDay: true, kind: 'out_of_office' },
			{ ...base, allDay: true, kind: 'event' },
		]);
		expect(result).toHaveLength(2);
	});
});

describe('datesTouched', () => {
	it('treats the end as exclusive', () => {
		expect(datesTouched(new Date('2026-11-02T10:00:00Z'), new Date('2026-11-03T00:00:00Z'), 'UTC')).toEqual({ from: '2026-11-02', to: '2026-11-02' });
		expect(datesTouched(new Date('2026-11-02T10:00:00Z'), new Date('2026-11-03T00:00:01Z'), 'UTC')).toEqual({ from: '2026-11-02', to: '2026-11-03' });
	});
});
