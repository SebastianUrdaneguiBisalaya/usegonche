/**
 * Date-time helpers. The API speaks UTC ISO instants (`2026-12-31T15:30:00.000Z`); the user sees and types wall-clock time in their stored
 * time zone (`UserSettings.timezone`). Date-only columns are calendar days, not instants: those stay in `features/protected/shared/dates.ts`.
 */

/** A backend UTC ISO datetime as a `Date` (an instant; format it with {@link formatDateTime}). */
export const fromApi = (iso: string): Date => new Date(iso);

/** `iso` formatted in the user's language and time zone. `timeZone` undefined falls back to the browser's. */
export function formatDateTime(iso: string | Date, locale: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(typeof iso === 'string' ? fromApi(iso) : iso);
}

/** Minutes after midnight on the wall clock of `timeZone` (undefined: the browser's) at the instant `at`. */
export function minuteInZone(at: Date, timeZone: string | undefined): number {
	if (!timeZone) return at.getHours() * 60 + at.getMinutes();
	const parts = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', minute: '2-digit', timeZone }).formatToParts(at);
	const get = (type: string): number => Number(parts.find(part => part.type === type)?.value);
	return get('hour') * 60 + get('minute');
}

/** Minutes the wall clock of `timeZone` is ahead of UTC at the instant `at` (DST aware). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		hour: '2-digit',
		hourCycle: 'h23',
		minute: '2-digit',
		month: '2-digit',
		second: '2-digit',
		timeZone,
		year: 'numeric',
	}).formatToParts(at);
	const get = (type: string): number => Number(parts.find(part => part.type === type)?.value);
	return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(at.getTime() / 1000) * 1000) / 60_000;
}

/**
 * The UTC ISO instant for a wall-clock time the user entered: a `YYYY-MM-DD` day plus minutes since midnight, read in `timeZone`
 * (undefined: the browser's). Minutes may overflow a day (`1500` is 01:00 the next day).
 */
export function toApi(dateOnly: string, minuteOfDay: number, timeZone: string | undefined): string {
	const [year = 1970, month = 1, day = 1] = dateOnly.split('-').map(Number);
	if (!timeZone) return new Date(year, month - 1, day, 0, minuteOfDay).toISOString();
	const wall = Date.UTC(year, month - 1, day, 0, minuteOfDay);
	// Two passes settle the offset when the guess lands on the other side of a DST change.
	let instant = wall - zoneOffsetMinutes(new Date(wall), timeZone) * 60_000;
	instant = wall - zoneOffsetMinutes(new Date(instant), timeZone) * 60_000;
	return new Date(instant).toISOString();
}
