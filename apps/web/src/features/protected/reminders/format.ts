import type { Reminder } from './api';

export type ReminderTab = 'all' | 'dismissed' | 'snoozed' | 'upcoming';

/** Upcoming = waiting to fire or already fired and not handled; Snoozed = postponed at least once and waiting; Dismissed = handled. */
export const tabOf = (reminder: Reminder): Exclude<ReminderTab, 'all'> =>
	reminder.status === 'dismissed' ? 'dismissed' : reminder.status === 'pending' && reminder.snoozeCount > 0 ? 'snoozed' : 'upcoming';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The calendar day of a date, as "Today", "Tomorrow" or "Nov 6, 2025". */
export function formatDay(date: Date, locale: string, now: Date = new Date()): string {
	const days = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
	if (Math.abs(days) <= 1) return capitalize(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day'));
	return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export const formatTime = (date: Date, locale: string): string => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);

/** "Today at 9:00 AM". */
export const formatWhen = (date: Date, locale: string, at: string): string => `${formatDay(date, locale)} ${at} ${formatTime(date, locale)}`;

/** Snooze presets: an hour from now, tomorrow at 9:00, next Monday at 9:00. */
export function snoozeOptions(now: Date = new Date()): { date: Date; id: 'hour' | 'tomorrow' | 'week' }[] {
	const at = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 9, 0, 0);
	const untilMonday = (8 - now.getDay()) % 7 || 7;
	return [
		{ date: new Date(now.getTime() + 3_600_000), id: 'hour' },
		{ date: at(1), id: 'tomorrow' },
		{ date: at(untilMonday), id: 'week' },
	];
}
