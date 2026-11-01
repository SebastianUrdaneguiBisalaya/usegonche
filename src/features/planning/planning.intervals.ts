import type { AvailabilityWindow, CalendarEvent } from '@usegonche/database';
import { datesBetween, isoWeekday, localDateOf, zonedToUtc } from '../../lib/time.js';

/** Half-open `[start, end)` range in epoch milliseconds. */
export type Interval = { end: number; start: number };

const MINUTE_MS = 60_000;

export const minutesOf = (intervals: Interval[]): number => Math.round(intervals.reduce((total, { end, start }) => total + (end - start), 0) / MINUTE_MS);

export const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

/** Sorts and merges touching or overlapping intervals. */
export const merge = (intervals: Interval[]): Interval[] => {
	const sorted = [...intervals].sort((a, b) => a.start - b.start);
	const merged: Interval[] = [];
	for (const interval of sorted) {
		const last = merged.at(-1);
		if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
		else merged.push({ ...interval });
	}
	return merged;
};

/** `base` minus every range in `cuts`. */
export const subtract = (base: Interval[], cuts: Interval[]): Interval[] => {
	let result = merge(base);
	for (const cut of merge(cuts)) {
		result = result.flatMap(interval => {
			if (!overlaps(interval, cut)) return [interval];
			const parts: Interval[] = [];
			if (interval.start < cut.start) parts.push({ end: cut.start, start: interval.start });
			if (cut.end < interval.end) parts.push({ end: interval.end, start: cut.end });
			return parts;
		});
	}
	return result;
};

export const clip = (interval: Interval, to: Interval): Interval | null => {
	const start = Math.max(interval.start, to.start);
	const end = Math.min(interval.end, to.end);
	return start < end ? { end, start } : null;
};

export const toInterval = (start: Date, end: Date): Interval => ({ end: end.getTime(), start: start.getTime() });

/** Working windows of every local date in `[from, to]` as instants (the weekly template applied to each date). */
export const availabilityIntervals = (windows: Pick<AvailabilityWindow, 'endMinute' | 'startMinute' | 'weekday'>[], from: string, to: string, timeZone: string): Interval[] =>
	datesBetween(from, to).flatMap(date =>
		windows.filter(window => window.weekday === isoWeekday(date)).map(window => toInterval(zonedToUtc(date, window.startMinute, timeZone), zonedToUtc(date, window.endMinute, timeZone)))
	);

/** Events that take the user's time away: out of office, and timed events. An all-day plain event is informational only. */
export const busyIntervals = (events: Pick<CalendarEvent, 'allDay' | 'endsAt' | 'kind' | 'startsAt'>[]): Interval[] =>
	events.filter(event => event.kind === 'out_of_office' || !event.allDay).map(event => toInterval(event.startsAt, event.endsAt));

/** Local dates touched by an instant range (end exclusive). */
export const datesTouched = (start: Date, end: Date, timeZone: string): { from: string; to: string } => ({
	from: localDateOf(start, timeZone),
	to: localDateOf(new Date(end.getTime() - 1), timeZone),
});
