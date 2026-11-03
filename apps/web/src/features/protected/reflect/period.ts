import { apiDateOnly, fromDateOnly, toDateOnly } from '../shared/dates';

/** The day after a `YYYY-MM-DD` date: where carried-over work lands by default. */
export const nextDay = (dateOnly: string): string => {
	const date = fromDateOnly(dateOnly) ?? new Date();
	return toDateOnly(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
};

/** "Nov 4, 2025" for a daily review, "Nov 3 – Nov 9, 2025" for a weekly one. */
export function formatPeriod(locale: string, kind: 'daily' | 'weekly', periodStart: string, periodEnd: string): string {
	const start = fromDateOnly(apiDateOnly(periodStart));
	const end = fromDateOnly(apiDateOnly(periodEnd));
	if (!start || !end) return '';
	const full = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
	if (kind === 'daily') return full.format(start);
	return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(start) + ' – ' + full.format(end);
}

/** Share of the planned tasks that were completed, 0..100. */
export const completionRate = (planned: number, completed: number): number => (planned > 0 ? Math.round((Math.min(completed, planned) / planned) * 100) : 0);
