import type { DateRange } from './api';

/** Lengths, in days, a range control offers. */
export const RANGE_PRESETS = ['7', '14', '30', '90'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const DEFAULT_PRESET: RangePreset = '30';

/** The last `days` local days ending today (inclusive), from the centralized datetime helper's `today`. */
export function rangeOf(preset: RangePreset, today: (days?: number) => string): DateRange {
	return { from: today(-(Number(preset) - 1)), to: today() };
}

/** Percentage change from `previous` to `current`, rounded; `null` when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
	if (previous <= 0) return null;
	return Math.round(((current - previous) / previous) * 100);
}

/** Change, in percentage points, between two 0..1 rates; `null` when either is missing. */
export function pointsChange(current: number | null, previous: number | null): number | null {
	if (current === null || previous === null) return null;
	return Math.round((current - previous) * 100);
}

/** "42%" for a 0..1 rate, "–" when there is none. */
export const formatRate = (rate: number | null): string => (rate === null ? '–' : `${Math.round(rate * 100)}%`);
