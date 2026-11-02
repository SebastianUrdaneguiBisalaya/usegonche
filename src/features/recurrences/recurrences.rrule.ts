import rrule, { type Frequency, type RRule } from 'rrule';

// `rrule` is CommonJS: Node ESM only exposes its default export, so the values come from it (the named imports above are types only).
const { RRule: RRuleClass, Frequency: Freq } = rrule;

const FREQUENCIES: Frequency[] = [Freq.DAILY, Freq.WEEKLY, Freq.MONTHLY, Freq.YEARLY];
const MAX_INTERVAL = 1000;

/**
 * Builds the RRule for a stored rule string. Tasks are scheduled by calendar day, so only daily or slower frequencies are accepted;
 * DTSTART always comes from `startDate` (a UTC-midnight date, treated as a floating day by `rrule`), never from the string.
 * Returns `null` when the string is not a valid RRULE for this app.
 */
export const buildRule = (rule: string, startDate: Date): RRule | null => {
	if (/DTSTART|TZID|RDATE|EXDATE/i.test(rule)) return null;
	try {
		const options = RRuleClass.parseString(rule);
		if (options.freq === undefined || !FREQUENCIES.includes(options.freq)) return null;
		if ((options.interval ?? 1) > MAX_INTERVAL) return null;
		return new RRuleClass({ ...options, dtstart: startDate });
	} catch {
		return null;
	}
};
