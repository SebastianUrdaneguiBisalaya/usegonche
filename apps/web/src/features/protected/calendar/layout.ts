import { addDays, isSameDay, startOfDay } from '~/components/ui/data-display/calendar/calendar';
import { toApi } from '~/lib/datetime';
import { toDateOnly } from '../shared/dates';
import type { CalendarEventItem } from './api';

/**
 * The calendar component draws plain local `Date`s, while the API speaks UTC instants and the user lives in their stored time zone.
 * `wallDate` turns an instant into the `Date` whose local fields read like the wall clock of `timeZone`; `fromWall` is its inverse.
 */
export function wallDate(at: string | Date, timeZone: string | undefined): Date {
	const instant = typeof at === 'string' ? new Date(at) : at;
	if (!timeZone) return instant;
	const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit', month: '2-digit', timeZone, year: 'numeric' }).formatToParts(instant);
	const get = (type: string): number => Number(parts.find(part => part.type === type)?.value);
	return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

/** The UTC ISO instant of a wall-clock `Date` (the inverse of {@link wallDate}). */
export function fromWall(date: Date, timeZone: string | undefined): string {
	return toApi(toDateOnly(date), date.getHours() * 60 + date.getMinutes(), timeZone);
}

/** The wall-clock range of an event. An all-day event ends at the midnight after its last day. */
export function wallRange(event: CalendarEventItem, timeZone: string | undefined): { end: Date; start: Date } {
	return { end: wallDate(event.endsAt, timeZone), start: wallDate(event.startsAt, timeZone) };
}

/** Whether a timed event starts and ends on the same wall-clock day (only those can be dragged or resized on the grid). */
export function isSingleDay(range: { end: Date; start: Date }): boolean {
	return isSameDay(range.start, new Date(range.end.getTime() - 1));
}

/** All-day events that cover `day`. */
export function allDayOn(events: CalendarEventItem[], day: Date, timeZone: string | undefined): CalendarEventItem[] {
	const dayStart = startOfDay(day);
	const dayEnd = addDays(dayStart, 1);
	return events.filter(event => {
		if (!event.allDay) return false;
		const { end, start } = wallRange(event, timeZone);
		return start < dayEnd && end > dayStart;
	});
}

export interface TimedSegment {
	end: Date;
	event: CalendarEventItem;
	lane: number;
	lanes: number;
	movable: boolean;
	start: Date;
}

/** The part of each timed event that falls on `day`, with the horizontal lane of overlapping ones. */
export function timedOn(events: CalendarEventItem[], day: Date, timeZone: string | undefined): TimedSegment[] {
	const dayStart = startOfDay(day);
	const dayEnd = addDays(dayStart, 1);
	const segments = events
		.filter(event => !event.allDay)
		.flatMap(event => {
			const range = wallRange(event, timeZone);
			if (range.end <= dayStart || range.start >= dayEnd) return [];
			return [{ end: range.end < dayEnd ? range.end : dayEnd, event, lane: 0, lanes: 1, movable: isSingleDay(range), start: range.start > dayStart ? range.start : dayStart }];
		})
		.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

	// Overlapping events form a cluster; inside it each takes the first lane that is free when it starts.
	let cluster: TimedSegment[] = [];
	let clusterEnd = 0;
	const laneEnds: number[] = [];
	const close = () => {
		for (const segment of cluster) segment.lanes = laneEnds.length;
		cluster = [];
		laneEnds.length = 0;
	};
	for (const segment of segments) {
		if (cluster.length > 0 && segment.start.getTime() >= clusterEnd) close();
		let lane = laneEnds.findIndex(end => end <= segment.start.getTime());
		if (lane === -1) lane = laneEnds.length;
		laneEnds[lane] = segment.end.getTime();
		segment.lane = lane;
		cluster.push(segment);
		clusterEnd = Math.max(clusterEnd, segment.end.getTime());
	}
	close();
	return segments;
}
