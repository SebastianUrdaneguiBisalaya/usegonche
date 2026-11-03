import type { Translate } from '~/i18n';

export const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type Frequency = (typeof frequencies)[number];

/** Monday first, like the week of the rest of the app. */
export const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof weekdays)[number];

/** The parts of an RRULE the form edits. Anything else in the rule (`COUNT`, `BYMONTHDAY`...) is kept in `rest` and written back as it was. */
export interface RuleParts {
	byDay: Weekday[];
	freq: Frequency;
	interval: number;
	rest: string[];
}

const isFrequency = (value: string | undefined): value is Frequency => frequencies.some(item => item === value);
const isWeekday = (value: string): value is Weekday => weekdays.some(item => item === value);

/** `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE` -> parts. `null` when the rule has no usable frequency. */
export function parseRule(rule: string): RuleParts | null {
	const parts = new Map<string, string>();
	const rest: string[] = [];
	for (const piece of rule.split(';')) {
		const [key, value] = piece.split('=');
		if (!key || value === undefined) continue;
		const name = key.toUpperCase();
		if (name === 'FREQ' || name === 'INTERVAL' || name === 'BYDAY') parts.set(name, value.toUpperCase());
		else rest.push(piece);
	}
	const freq = parts.get('FREQ');
	if (!isFrequency(freq)) return null;
	const interval = Number.parseInt(parts.get('INTERVAL') ?? '1', 10);
	const byDay = (parts.get('BYDAY') ?? '').split(',').filter(isWeekday);
	return { byDay, freq, interval: Number.isFinite(interval) && interval > 0 ? interval : 1, rest };
}

/** Parts -> RRULE. Weekdays only apply to a weekly rule. */
export function buildRule({ byDay, freq, interval, rest }: RuleParts): string {
	return [
		`FREQ=${freq}`,
		...(interval > 1 ? [`INTERVAL=${interval}`] : []),
		...(freq === 'WEEKLY' && byDay.length > 0 ? [`BYDAY=${weekdays.filter(day => byDay.includes(day)).join(',')}`] : []),
		...rest,
	].join(';');
}

/** "Every 2 weeks on Mon, Wed". */
export function describeRule(rule: string, t: Translate, locale: string): string {
	const parts = parseRule(rule);
	if (!parts) return rule;
	const unit = parts.freq.toLowerCase() as Lowercase<Frequency>;
	const base = t(parts.interval === 1 ? `recurrences.rule.${unit}_one` : `recurrences.rule.${unit}_other`, { count: parts.interval });
	if (parts.freq !== 'WEEKLY' || parts.byDay.length === 0) return base;
	const names = new Intl.DateTimeFormat(locale, { weekday: 'short' });
	// 2024-01-01 is a Monday.
	const days = weekdays.filter(day => parts.byDay.includes(day)).map(day => names.format(new Date(2024, 0, 1 + weekdays.indexOf(day))));
	return `${base} ${t('recurrences.rule.on', { days: days.join(', ') })}`;
}

/** "9:00 AM" for minutes from midnight. */
export function formatMinute(minute: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2024, 0, 1, Math.floor(minute / 60), minute % 60));
}

/** `HH:MM` (what `<input type="time">` holds) <-> minutes from midnight. */
export const timeToMinute = (time: string): number | null => {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
export const minuteToTime = (minute: number | null): string => (minute === null ? '' : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
