import type { AvailabilityWindow } from './api';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const DAY_END = 1440;

/** A window being edited: `key` identifies the row, the minutes are local to the user's time zone. */
export interface Draft extends AvailabilityWindow {
	key: string;
}

export type WindowError = 'end_before_start' | 'overlapping';

/** `HH:mm` of a minute of the day; the end of the day (24:00) reads as 23:59 in a time field. */
export function toTimeValue(minute: number): string {
	const clamped = Math.min(minute, DAY_END - 1);
	return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** Minute of the day of an `HH:mm` value, or `null` when empty. */
export function fromTimeValue(value: string): number | null {
	const [hours, minutes] = value.split(':').map(Number);
	return hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes) ? null : hours * 60 + minutes;
}

/** What the API would refuse, found before sending: an end that is not after the start, and windows of one weekday that overlap. */
export function findErrors(windows: readonly Draft[]): Map<string, WindowError> {
	const errors = new Map<string, WindowError>();
	for (const window of windows) {
		if (window.endMinute <= window.startMinute) errors.set(window.key, 'end_before_start');
	}
	for (const window of windows) {
		if (errors.has(window.key)) continue;
		const clash = windows.some(other => other.key !== window.key && other.weekday === window.weekday && other.startMinute < window.endMinute && window.startMinute < other.endMinute);
		if (clash) errors.set(window.key, 'overlapping');
	}
	return errors;
}

/** The windows as the API stores them: ordered by weekday and start, without the row keys. */
export const toPayload = (windows: readonly Draft[]): AvailabilityWindow[] =>
	windows.map(({ endMinute, startMinute, weekday }) => ({ endMinute, startMinute, weekday })).sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);

export const sameWindows = (a: readonly AvailabilityWindow[], b: readonly AvailabilityWindow[]): boolean =>
	a.length === b.length && a.every((window, index) => window.weekday === b[index]?.weekday && window.startMinute === b[index]?.startMinute && window.endMinute === b[index]?.endMinute);

/** "38h", "37h 30m": a total of minutes. */
export function formatTotal(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return `${rest}m`;
	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
