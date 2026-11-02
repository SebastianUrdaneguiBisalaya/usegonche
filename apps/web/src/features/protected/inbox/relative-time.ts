const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31_536_000],
	['month', 2_592_000],
	['week', 604_800],
	['day', 86_400],
	['hour', 3600],
	['minute', 60],
];

/** "2m ago" / "hace 2 min": the biggest unit that fits, in the user's language. Under a minute reads as "now". */
export function formatRelative(iso: string, locale: string, now: number = Date.now()): string {
	const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' });
	for (const [unit, size] of UNITS) if (Math.abs(seconds) >= size) return formatter.format(Math.trunc(seconds / size), unit);
	return formatter.format(0, 'second');
}
