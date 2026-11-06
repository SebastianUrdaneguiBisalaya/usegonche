import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import mobileEn from './locales/mobile.en.json';
import mobileEs from './locales/mobile.es.json';

/**
 * Same locales and keys as the web: `locales/{en,es}.json` are verbatim copies of `apps/web/src/locales` (re-copy them when the web changes).
 * Texts that only exist on mobile live in `locales/mobile.*.json` under the `mobile` key, so the copies never need hand edits.
 */
export const locales = ['en', 'es'] as const;

export type Locale = (typeof locales)[number];

/** `"system"` follows the device's language; the others are explicit. Same values as the account's `UserSettings.language`. */
export type LanguagePreference = 'system' | Locale;

export const defaultLocale: Locale = 'en';

const catalogs = { en: { ...en, ...mobileEn }, es: { ...es, ...mobileEs } };

/** Every dotted path to a string in the catalog (`"auth.signIn.title"`), so a mistyped key fails in `tsc`. */
type Paths<T> = {
	[K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = Paths<(typeof catalogs)['es']>;

export function isLocale(value: unknown): value is Locale {
	return locales.some(locale => locale === value);
}

/** The first device language the app has a catalog for, else `defaultLocale`. */
export function deviceLocale(): Locale {
	for (const { languageCode } of getLocales()) {
		if (isLocale(languageCode)) return languageCode;
	}
	return defaultLocale;
}

/**
 * The account's saved language (`"system"`, a code, or a regional one like `es-PE`, read as `es`) as a preference.
 * `undefined` when unset or unsupported, so the device language applies.
 */
export function languagePreferenceOf(value: unknown): LanguagePreference | undefined {
	if (value === 'system') return 'system';
	if (typeof value !== 'string') return undefined;
	const language = value.toLowerCase().split('-')[0];
	return isLocale(language) ? language : undefined;
}

export function resolveLocale(preference: LanguagePreference = 'system'): Locale {
	return preference === 'system' ? deviceLocale() : preference;
}

// Catalogs are bundled, so init is synchronous and the first render already has real texts.
void i18next.use(initReactI18next).init({
	fallbackLng: defaultLocale,
	initAsync: false,
	interpolation: { escapeValue: false },
	lng: deviceLocale(),
	resources: { en: { translation: catalogs.en }, es: { translation: catalogs.es } },
});

export const i18n = i18next;

export function activateLocale(locale: Locale) {
	if (i18n.language !== locale) void i18n.changeLanguage(locale);
}
