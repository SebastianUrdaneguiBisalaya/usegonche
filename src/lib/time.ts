/**
 * Calendar-day helpers in an IANA timezone, without a date library (Intl only, works on Node and Workers).
 * A "date" is a plain `YYYY-MM-DD` string (a calendar day, no timezone); instants are `Date`s.
 */

const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', { day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit', month: '2-digit', second: '2-digit', timeZone, year: 'numeric' });
		formatters.set(timeZone, formatter);
	}
	return formatter;
};

const partsOf = (instantMs: number, timeZone: string): Record<string, number> => {
	const parts: Record<string, number> = {};
	for (const part of formatterFor(timeZone).formatToParts(new Date(instantMs))) if (part.type !== 'literal') parts[part.type] = Number(part.value);
	return parts;
};

/** Offset of the timezone from UTC at that instant, in ms (positive east of UTC). */
const offsetMs = (instantMs: number, timeZone: string): number => {
	const p = partsOf(instantMs, timeZone);
	return Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instantMs / 1000) * 1000;
};

const parseDate = (date: string): [number, number, number] => {
	const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
	return [y, m, d];
};

/** The instant at which the local wall clock in `timeZone` reads `minuteOfDay` on `date` (1440 = midnight ending the day). */
export const zonedToUtc = (date: string, minuteOfDay: number, timeZone: string): Date => {
	const [y, m, d] = parseDate(date);
	const wall = Date.UTC(y, m - 1, d, 0, minuteOfDay);
	let utc = wall - offsetMs(wall, timeZone);
	const corrected = wall - offsetMs(utc, timeZone);
	if (corrected !== utc) utc = corrected;
	return new Date(utc);
};

/** `[start, end)` instants of a local calendar day (23 or 25 hours on DST changes). */
export const dayRange = (date: string, timeZone: string): { end: Date; start: Date } => ({ end: zonedToUtc(date, 1440, timeZone), start: zonedToUtc(date, 0, timeZone) });

/** The local calendar date (`YYYY-MM-DD`) of an instant. */
export const localDateOf = (instant: Date, timeZone: string): string => {
	const p = partsOf(instant.getTime(), timeZone);
	return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

export const addDays = (date: string, days: number): string => {
	const [y, m, d] = parseDate(date);
	return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
};

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday. */
export const isoWeekday = (date: string): number => {
	const [y, m, d] = parseDate(date);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
};

/** Every date from `from` to `to` inclusive. */
export const datesBetween = (from: string, to: string): string[] => {
	const dates: string[] = [];
	for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
	return dates;
};

export const isValidDate = (value: string): boolean => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
