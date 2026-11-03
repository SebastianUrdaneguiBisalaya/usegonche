const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31_536_000],
	['month', 2_592_000],
	['week', 604_800],
	['day', 86_400],
	['hour', 3600],
	['minute', 60],
];

function relative(iso: string, locale: string, now: number, style: 'long' | 'narrow', numeric: 'always' | 'auto'): string {
	const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size) return new Intl.RelativeTimeFormat(locale, { numeric, style }).format(Math.trunc(seconds / size), unit);
	}
	return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style }).format(0, 'second');
}

/** "2m ago" / "hace 2 min": the biggest unit that fits, in the user's language. Under a minute reads as "now". */
export function formatRelative(iso: string, locale: string, now: number = Date.now()): string {
	return relative(iso, locale, now, 'narrow', 'auto');
}

/** "1 day ago" / "hace 1 día": the same, written out in full (never "yesterday"). */
export function formatRelativeLong(iso: string, locale: string, now: number = Date.now()): string {
	return relative(iso, locale, now, 'long', 'always');
}
