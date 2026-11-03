import { createClient } from '@usegonche/api-client';
import type { ThemePreference } from '~/components/ui/actions-controls/switch-theme/switch-theme';
import { type LanguagePreference, languagePreferenceOf } from '~/i18n';
import { API_BASE } from '~/lib/api';
import { isThemePreference } from '~/lib/theme';

/** The server must not wait on the API to paint: past this the page renders with the cookies instead. */
const TIMEOUT_MS = 2000;

export interface AccountPreferences {
	language?: LanguagePreference;
	theme?: ThemePreference;
}

/**
 * Theme and language saved on the account (`UserSettings`), read with the request's session cookie, so a first paint on a browser that has never
 * seen this user (a fresh login, another device, cleared cookies, someone else's leftovers) already uses them instead of flashing the system
 * defaults. Empty when there is no session, the API does not answer in time, or a value is unset or unsupported: the cookies and then the
 * system / `Accept-Language` take over, as before.
 */
export async function accountPreferences(request: Request): Promise<AccountPreferences> {
	const cookie = request.headers.get('cookie');
	if (!cookie) return {};
	try {
		const res = await createClient(API_BASE, { headers: { cookie }, init: { signal: AbortSignal.timeout(TIMEOUT_MS) } }).profile.settings.$get();
		if (!res.ok) return {};
		const { data } = await res.json();
		return { language: languagePreferenceOf(data.language), theme: isThemePreference(data.theme) ? data.theme : undefined };
	} catch {
		return {};
	}
}
