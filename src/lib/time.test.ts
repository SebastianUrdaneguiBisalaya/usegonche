import { describe, expect, it } from 'vitest';
import { addDays, datesBetween, dayRange, isoWeekday, isValidDate, localDateOf, zonedToUtc } from './time.js';

describe('zonedToUtc', () => {
	it('is the identity in UTC', () => {
		expect(zonedToUtc('2026-11-02', 9 * 60, 'UTC').toISOString()).toBe('2026-11-02T09:00:00.000Z');
	});

	it('applies the zone offset (Lima is UTC-5 all year)', () => {
		expect(zonedToUtc('2026-11-02', 9 * 60, 'America/Lima').toISOString()).toBe('2026-11-02T14:00:00.000Z');
	});

	it('follows DST: New York is UTC-4 in July and UTC-5 in January', () => {
		expect(zonedToUtc('2026-07-01', 9 * 60, 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
		expect(zonedToUtc('2026-01-15', 9 * 60, 'America/New_York').toISOString()).toBe('2026-01-15T14:00:00.000Z');
	});

	it('handles zones east of UTC (Tokyo is UTC+9)', () => {
		expect(zonedToUtc('2026-11-02', 8 * 60, 'Asia/Tokyo').toISOString()).toBe('2026-11-01T23:00:00.000Z');
	});

	it('treats minute 1440 as the next local midnight', () => {
		expect(zonedToUtc('2026-11-02', 1440, 'America/Lima').toISOString()).toBe('2026-11-03T05:00:00.000Z');
	});
});

describe('dayRange', () => {
	it('is 24 hours on a regular day', () => {
		const { end, start } = dayRange('2026-11-02', 'America/Lima');
		expect(end.getTime() - start.getTime()).toBe(24 * 3_600_000);
	});

	it('is 25 hours when DST ends (New York, 2026-11-01) and 23 when it starts (2026-03-08)', () => {
		const fall = dayRange('2026-11-01', 'America/New_York');
		expect((fall.end.getTime() - fall.start.getTime()) / 3_600_000).toBe(25);
		const spring = dayRange('2026-03-08', 'America/New_York');
		expect((spring.end.getTime() - spring.start.getTime()) / 3_600_000).toBe(23);
	});
});

describe('localDateOf', () => {
	it('returns the local calendar date of an instant', () => {
		const instant = new Date('2026-11-03T02:00:00.000Z');
		expect(localDateOf(instant, 'UTC')).toBe('2026-11-03');
		expect(localDateOf(instant, 'America/Lima')).toBe('2026-11-02');
		expect(localDateOf(instant, 'Asia/Tokyo')).toBe('2026-11-03');
	});
});

describe('date arithmetic', () => {
	it('adds days across months and years', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('gives the ISO weekday', () => {
		expect(isoWeekday('2026-11-02')).toBe(1);
		expect(isoWeekday('2026-11-08')).toBe(7);
	});

	it('lists dates inclusive', () => {
		expect(datesBetween('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
		expect(datesBetween('2026-11-03', '2026-11-01')).toEqual([]);
	});

	it('validates calendar dates', () => {
		expect(isValidDate('2026-02-28')).toBe(true);
		expect(isValidDate('2026-02-30')).toBe(false);
		expect(isValidDate('2026-2-3')).toBe(false);
	});
});
