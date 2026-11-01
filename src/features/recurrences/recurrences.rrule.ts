import { Frequency, RRule } from 'rrule';

const FREQUENCIES: Frequency[] = [Frequency.DAILY, Frequency.WEEKLY, Frequency.MONTHLY, Frequency.YEARLY];
const MAX_INTERVAL = 1000;

/**
 * Builds the RRule for a stored rule string. Tasks are scheduled by calendar day, so only daily or slower frequencies are accepted;
 * DTSTART always comes from `startDate` (a UTC-midnight date, treated as a floating day by `rrule`), never from the string.
 * Returns `null` when the string is not a valid RRULE for this app.
 */
export const buildRule = (rule: string, startDate: Date): RRule | null => {
	if (/DTSTART|TZID|RDATE|EXDATE/i.test(rule)) return null;
	try {
		const options = RRule.parseString(rule);
		if (options.freq === undefined || !FREQUENCIES.includes(options.freq)) return null;
		if ((options.interval ?? 1) > MAX_INTERVAL) return null;
		return new RRule({ ...options, dtstart: startDate });
	} catch {
		return null;
	}
};
