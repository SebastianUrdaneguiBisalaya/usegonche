import { describe, expect, it } from 'vitest';
import { buildRule } from './recurrences.rrule.js';

const start = new Date('2026-11-02T00:00:00Z');

describe('buildRule', () => {
	it('expands a weekly rule from the start date in UTC days', () => {
		const dates = buildRule('FREQ=WEEKLY;BYDAY=MO', start)?.between(new Date('2026-11-02T00:00:00Z'), new Date('2026-11-16T00:00:00Z'), true);
		expect(dates?.map(date => date.toISOString().slice(0, 10))).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
	});

	it('respects COUNT and UNTIL', () => {
		expect(buildRule('FREQ=DAILY;COUNT=2', start)?.all()).toHaveLength(2);
		expect(buildRule('FREQ=DAILY;UNTIL=20261103T000000Z', start)?.all()).toHaveLength(2);
	});

	it.each(['', 'nonsense', 'FREQ=HOURLY', 'FREQ=MINUTELY', 'FREQ=DAILY;INTERVAL=1001', 'DTSTART:20261102T000000Z\nRRULE:FREQ=DAILY', 'FREQ=DAILY;TZID=UTC', 'FREQ=NOPE'])('rejects %j', rule => {
		expect(buildRule(rule, start)).toBeNull();
	});
});
