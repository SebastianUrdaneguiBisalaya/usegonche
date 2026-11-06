import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { activateLocale, languagePreferenceOf, resolveLocale } from '@/i18n';
import { api } from '@/lib/api';
import { unwrap } from '@/lib/api-error';

export const settingsKey = ['settings'] as const;

/** `GET /profile/settings`: theme, language and whether the mandatory onboarding is done. Only while signed in. */
export function useAccountSettings(enabled: boolean) {
	return useQuery({
		enabled,
		queryFn: () => unwrap(api.profile.settings.$get()),
		queryKey: settingsKey,
	});
}

type Settings = NonNullable<ReturnType<typeof useAccountSettings>['data']>;

/**
 * The account's theme and language win over the device's while signed in (same as the web); signed out, or with nothing saved,
 * the device's apply. `Appearance.setColorScheme` overrides what `useColorScheme()` answers, so the theme tokens follow it.
 */
export function useApplyAccountSettings(settings: Settings | undefined) {
	const theme = settings?.theme;
	const language = settings?.language;

	useEffect(() => {
		Appearance.setColorScheme(theme === 'light' || theme === 'dark' ? theme : 'unspecified');
	}, [theme]);

	useEffect(() => {
		activateLocale(resolveLocale(languagePreferenceOf(language) ?? 'system'));
	}, [language]);
}
