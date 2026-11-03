/** "Oct 5" for a `YYYY-MM-DD` day (a calendar day, so it is read as UTC and never shifts with a time zone). */
export function dayLabel(date: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

/** Weekday name of an ISO weekday (1 = Monday ... 7 = Sunday). */
export function weekdayName(weekday: number, locale: string): string {
	// 2024-01-01 was a Monday.
	return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' }).format(new Date(Date.UTC(2024, 0, weekday)));
}

/** "10 AM" / "10:00" for an hour of the day, in the locale's clock style. */
export function hourName(hour: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1, hour)));
}

/** Hours with one decimal ("1.5") from minutes. */
export const toHours = (minutes: number): number => Math.round((minutes / 60) * 10) / 10;
