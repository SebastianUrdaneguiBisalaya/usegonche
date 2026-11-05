import type { RouterContextProvider } from 'react-router';
import type { ThemePreference } from '~/components/ui/actions-controls/switch-theme/switch-theme';
import { type LanguagePreference, languagePreferenceOf } from '~/i18n';
import { accountSettings } from '~/lib/session.server';
import { isThemePreference } from '~/lib/theme';

/** The server must not wait on the API to paint: past this the page renders with the cookies instead. */
const TIMEOUT_MS = 2000;

export interface AccountPreferences {
	language?: LanguagePreference;
	theme?: ThemePreference;
}

/**
 * Theme and language saved on the account (`UserSettings`), read with the request's session cookie (one request shared with the signed-in loaders, see `accountSettings`), so a first paint on a browser that has never
 * seen this user (a fresh login, another device, cleared cookies, someone else's leftovers) already uses them instead of flashing the system
 * defaults. Empty when there is no session, the API does not answer in time, or a value is unset or unsupported: the cookies and then the
 * system / `Accept-Language` take over, as before.
 */
export async function accountPreferences(request: Request, context: Readonly<RouterContextProvider>): Promise<AccountPreferences> {
	const answer = accountSettings(request, context);
	if (!answer) return {};
	try {
		const timeout = new Promise<undefined>(resolve => setTimeout(resolve, TIMEOUT_MS));
		const data = (await Promise.race([answer, timeout]))?.data;
		if (!data) return {};
		return { language: languagePreferenceOf(data.language), theme: isThemePreference(data.theme) ? data.theme : undefined };
	} catch {
		return {};
	}
}
