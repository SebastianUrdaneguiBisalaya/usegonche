import { getCountry } from 'countries-and-timezones';

/**
 * Time zone to save with a country: the browser's own when it belongs to that country (so a user in
 * Brazil's `America/Manaus` keeps it), otherwise the country's main one. `undefined` for a country with none.
 */
export function timezoneForCountry(code: string, browserZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone): string | undefined {
	const zones: readonly string[] = getCountry(code as Parameters<typeof getCountry>[0])?.timezones ?? [];
	return zones.includes(browserZone) ? browserZone : zones[0];
}
