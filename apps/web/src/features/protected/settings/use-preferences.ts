import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { ThemePreference } from '~/components/ui/actions-controls/switch-theme/switch-theme';
import { useLanguage } from '~/hooks/use-language';
import { useTheme } from '~/hooks/use-theme';
import { type LanguagePreference, languagePreferenceOf } from '~/i18n';
import { useLanguageStore } from '~/store/language-store';
import { useThemeStore } from '~/store/theme-store';
import { settingsKey, type UpdateSettingsBody, type UserSettings, useUpdateSettings, useUserSettings } from './api';

const isTheme = (value: unknown): value is ThemePreference => value === 'system' || value === 'light' || value === 'dark';

/**
 * The account is the source of truth for theme and language, and the cookie is only the local cache that lets the server render the right
 * ones on the first byte. When the saved settings load (or change) and differ from the cache, they replace it. Mount it once, in the signed-in layout.
 */
export function useSyncPreferences(): void {
	const { data: settings } = useUserSettings();
	// Reading them through the hooks also rehydrates the stores from the cookie, which has to happen before the account's values are applied.
	useTheme();
	useLanguage();
	const themeHydrated = useThemeStore(state => state.hydrated);
	const languageHydrated = useLanguageStore(state => state.hydrated);

	useEffect(() => {
		if (!settings || !themeHydrated || !languageHydrated) return;
		const theme = useThemeStore.getState();
		if (isTheme(settings.theme) && settings.theme !== theme.preference) theme.setPreference(settings.theme);
		const language = useLanguageStore.getState();
		// A regional code like `es-PE` reads as its language; one the app has no catalog for counts as unset.
		const saved = languagePreferenceOf(settings.language);
		if (saved && saved !== language.preference) language.setPreference(saved);
	}, [settings, themeHydrated, languageHydrated]);
}

/**
 * Changing a preference applies it on this device at once and saves it on the account in the background. The cache is updated first so a
 * refetch that lands before the save finishes cannot undo the change; if the save fails the change stays local and a toast says so.
 */
export function usePreferences() {
	const queryClient = useQueryClient();
	const { preference: theme, setPreference: setLocalTheme } = useTheme();
	const { locale, preference: language, setPreference: setLocalLanguage } = useLanguage();
	const update = useUpdateSettings();

	const save = (changes: Pick<UpdateSettingsBody, 'language' | 'theme'>) => {
		queryClient.setQueryData<UserSettings>(settingsKey, current => current && { ...current, ...changes });
		update.mutate(changes);
	};

	return {
		language,
		locale,
		setLanguage: (next: LanguagePreference) => {
			setLocalLanguage(next);
			save({ language: next });
		},
		setTheme: (next: ThemePreference) => {
			setLocalTheme(next);
			save({ theme: next });
		},
		theme,
	};
}
