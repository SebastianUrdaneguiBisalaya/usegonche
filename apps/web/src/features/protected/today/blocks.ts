import { toApi } from '~/lib/datetime';

export const MINUTES_PER_DAY = 1440;
export const SNAP_MINUTES = 15;
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const;

/** The instant `minute` minutes after midnight of a `YYYY-MM-DD` day in the user's time zone (undefined: the browser's). */
export function atMinute(dateOnly: string, minute: number, timeZone: string | undefined): Date {
	return new Date(toApi(dateOnly, minute, timeZone));
}

/** Minutes after midnight of `dateOnly` in the user's time zone, clamped to the day. */
export function minuteOf(dateOnly: string, iso: string, timeZone: string | undefined): number {
	const minutes = (new Date(iso).getTime() - atMinute(dateOnly, 0, timeZone).getTime()) / 60_000;
	return Math.min(Math.max(Math.round(minutes), 0), MINUTES_PER_DAY);
}

export const snap = (minute: number): number => Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES;

/** `HH:mm` of a minute of the day (the value of a time field). */
export function toTimeValue(minute: number): string {
	return `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** Minute of the day of an `HH:mm` value, or `null` when empty. */
export function fromTimeValue(value: string): number | null {
	const [hours, minutes] = value.split(':').map(Number);
	return hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes) ? null : hours * 60 + minutes;
}
