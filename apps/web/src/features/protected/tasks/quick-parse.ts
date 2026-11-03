import { toDateOnly } from '../shared/dates';
import type { TaskPriority } from './search-params';

/** What the quick-add bar reads from a line like `Review contract #legal !high tomorrow ~1h`. */
export interface ParsedTask {
	/** `YYYY-MM-DD` (the user's calendar day). */
	dueDate?: string;
	/** Minutes from `~30m`, `~1h` or `~1h30`. */
	estimatedMinutes?: number;
	priority?: TaskPriority;
	/** Text after `#`, to be matched against the project names. */
	projectName?: string;
	/** What is left once the markers are removed. */
	title: string;
}

const PRIORITIES: Record<string, TaskPriority> = {
	alta: 'high',
	baja: 'low',
	high: 'high',
	low: 'low',
	media: 'medium',
	medium: 'medium',
	urgent: 'urgent',
	urgente: 'urgent',
};

/** Monday-first weekday numbers (0 = Sunday, like `Date#getDay`). */
const WEEKDAYS: Record<string, number> = {
	domingo: 0,
	friday: 5,
	jueves: 4,
	lunes: 1,
	martes: 2,
	miercoles: 3,
	miércoles: 3,
	monday: 1,
	saturday: 6,
	sunday: 0,
	thursday: 4,
	tuesday: 2,
	viernes: 5,
	wednesday: 3,
	sabado: 6,
	sábado: 6,
};

const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The next date (today excluded) that falls on `weekday`. */
const nextWeekday = (today: Date, weekday: number): Date => addDays(today, ((weekday - today.getDay() + 6) % 7) + 1);

const validDay = (year: number, month: number, day: number): Date | undefined => {
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
};

/**
 * Light natural-language reading of a task line, on the client and without AI: `#project`, `!priority`, `~estimate` and a date
 * (`today`/`hoy`, `tomorrow`/`mañana`, a weekday, `in 3 days`, `2026-12-31`, `24/12`). Every marker is removed from the title. A
 * date word is only taken as a date at the end of the line, so "Call mañana's client" is not misread.
 *
 * `today` is the user's calendar day (a local `Date` at that day, from `fromDateOnly(useDateTime().today())`), in their stored time zone. It is required on
 * purpose: defaulting to the browser's clock would resolve "today"/"tomorrow" to another day than the rest of the app around midnight.
 */
export function parseQuickTask(input: string, today: Date): ParsedTask {
	let text = ` ${input} `;
	const result: ParsedTask = { title: '' };

	const take = (pattern: RegExp, apply: (match: RegExpMatchArray) => boolean): void => {
		const match = text.match(pattern);
		if (match && apply(match)) text = text.replace(pattern, ' ');
	};

	take(/\s#("[^"]+"|[^\s#!~]+)/, match => {
		result.projectName = (match[1] ?? '').replace(/^"|"$/g, '').trim();
		return result.projectName.length > 0;
	});
	take(/\s!([\p{L}]+)/u, match => {
		const priority = PRIORITIES[(match[1] ?? '').toLowerCase()];
		if (priority) result.priority = priority;
		return priority !== undefined;
	});
	take(/\s~(?:(\d{1,2})h(?:(\d{1,2})m?)?|(\d{1,4})m)(?=\s)/i, match => {
		const minutes = match[3] ? Number(match[3]) : Number(match[1]) * 60 + Number(match[2] ?? 0);
		if (minutes < 1) return false;
		result.estimatedMinutes = minutes;
		return true;
	});

	// Dates: only a trailing expression counts, so the date never eats part of the title.
	const trailing = (source: string): RegExp => new RegExp(`\\s(?:${source})(?=\\s*$)`, 'iu');
	const setDate = (date: Date | undefined): boolean => {
		if (!date) return false;
		result.dueDate = toDateOnly(date);
		return true;
	};
	take(trailing('(\\d{4})-(\\d{2})-(\\d{2})'), match => setDate(validDay(Number(match[1]), Number(match[2]), Number(match[3]))));
	take(trailing('(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}))?'), match => {
		const day = Number(match[1]);
		const month = Number(match[2]);
		const explicitYear = match[3] ? Number(match[3]) : undefined;
		const year = explicitYear ?? today.getFullYear();
		const date = validDay(year, month, day);
		// Without a year, a day that already passed means the next year.
		return setDate(date && !explicitYear && date < addDays(today, 0) && toDateOnly(date) !== toDateOnly(today) ? validDay(year + 1, month, day) : date);
	});
	// `en 3 días`, `in 2 weeks`.
	if (!result.dueDate) {
		take(trailing('(?:en|in)\\s+(\\d{1,3})\\s+(d[ií]as?|days?|semanas?|weeks?)'), match => {
			const weeks = /^(s|w)/i.test(match[2] ?? '');
			return setDate(addDays(today, Number(match[1]) * (weeks ? 7 : 1)));
		});
	}
	if (!result.dueDate) take(trailing('pasado\\s+ma[ñn]ana|day\\s+after\\s+tomorrow'), () => setDate(addDays(today, 2)));
	if (!result.dueDate) {
		take(trailing('hoy|today'), () => setDate(today));
		take(trailing('ma[ñn]ana|tomorrow'), () => setDate(addDays(today, 1)));
	}
	if (!result.dueDate) {
		take(trailing(Object.keys(WEEKDAYS).join('|')), match => {
			const weekday = WEEKDAYS[(match[0] ?? '').trim().toLowerCase()];
			return weekday !== undefined && setDate(nextWeekday(today, weekday));
		});
	}

	// A connector left dangling by the date ('report on friday', 'informe el viernes').
	if (result.dueDate) text = text.replace(/\s(?:el|on|by|for|para|the)\s*$/iu, ' ');

	result.title = text.replace(/\s+/g, ' ').trim();
	return result;
}
