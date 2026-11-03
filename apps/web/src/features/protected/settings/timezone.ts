import { getCountry, getTimezone } from 'countries-and-timezones';

/**
 * Time zone to save with a country: the browser's own when it belongs to that country (so a user in
 * Brazil's `America/Manaus` keeps it), otherwise the country's main one. `undefined` for a country with none.
 */
export function timezoneForCountry(code: string, browserZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone): string | undefined {
	const zones: readonly string[] = getCountry(code as Parameters<typeof getCountry>[0])?.timezones ?? [];
	return zones.includes(browserZone) ? browserZone : zones[0];
}

/** Country (ISO code) of a time zone name, e.g. `America/Lima` -> `PE`. `undefined` when the zone belongs to none or to several (`UTC`). */
export function countryForTimezone(timezone: string): string | undefined {
	const countries = getTimezone(timezone)?.countries ?? [];
	return countries.length === 1 ? countries[0] : undefined;
}
