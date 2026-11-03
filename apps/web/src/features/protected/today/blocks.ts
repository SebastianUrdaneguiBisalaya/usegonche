export const MINUTES_PER_DAY = 1440;
export const SNAP_MINUTES = 15;
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const;

/** The instant `minute` minutes after local midnight of a `YYYY-MM-DD` day. */
export function atMinute(dateOnly: string, minute: number): Date {
	const [year, month, day] = dateOnly.split('-').map(Number);
	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, minute);
}

/** Minutes after local midnight of `dateOnly`, clamped to the day. */
export function minuteOf(dateOnly: string, iso: string): number {
	const minutes = (new Date(iso).getTime() - atMinute(dateOnly, 0).getTime()) / 60_000;
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
