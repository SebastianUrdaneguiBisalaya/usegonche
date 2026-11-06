import { type Country, getCountries, type Labels } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import es from 'react-phone-number-input/locale/es.json';
import type { Locale } from '~/i18n';

/** Country names of the phone picker, in each app language. */
export const phoneLabels: Record<Locale, Labels> = { en, es };

const supported = new Set<string>(getCountries());

/** The account's country (ISO code from onboarding) as a phone-picker country; `undefined` when unset or unknown to the picker. */
export const toPhoneCountry = (code: string | null | undefined): Country | undefined => {
	const upper = code?.toUpperCase();
	return upper && supported.has(upper) ? (upper as Country) : undefined;
};
