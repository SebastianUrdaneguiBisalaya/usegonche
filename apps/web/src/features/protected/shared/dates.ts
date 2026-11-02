/** `YYYY-MM-DD` of a date picked in the user's calendar (local day, so it never shifts by timezone). */
export const toDateOnly = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The local day a `YYYY-MM-DD` string stands for, or `null` when empty. */
export const fromDateOnly = (value: string): Date | null => {
	const [year, month, day] = value.split('-').map(Number);
	return year && month && day ? new Date(year, month - 1, day) : null;
};

/** `YYYY-MM-DD` of an API date column (`2026-12-31T00:00:00.000Z`), which is a calendar day, not an instant. */
export const apiDateOnly = (iso: string | null): string => (iso ? iso.slice(0, 10) : '');
