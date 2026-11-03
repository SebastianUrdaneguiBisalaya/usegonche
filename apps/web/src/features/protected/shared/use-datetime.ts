import { useMemo } from 'react';
import { useLanguage } from '~/hooks/use-language';
import { formatDateTime, toApi } from '~/lib/datetime';
import { useUserSettings } from '../settings/api';

/** Formats API instants in the user's language and stored time zone, and converts what they enter back to UTC ISO. */
export function useDateTime() {
	const { locale } = useLanguage();
	const timeZone = useUserSettings().data?.timezone ?? undefined;
	return useMemo(
		() => ({
			/** "Nov 3, 2026" */
			formatDate: (iso: string) => formatDateTime(iso, locale, timeZone, { dateStyle: 'medium' }),
			/** "Nov 3, 2026, 3:30 PM" */
			formatDateTime: (iso: string) => formatDateTime(iso, locale, timeZone, { dateStyle: 'medium', timeStyle: 'short' }),
			/** "3:30 PM" */
			formatTime: (iso: string) => formatDateTime(iso, locale, timeZone, { hour: 'numeric', minute: '2-digit' }),
			timeZone,
			toApi: (dateOnly: string, minuteOfDay: number) => toApi(dateOnly, minuteOfDay, timeZone),
		}),
		[locale, timeZone]
	);
}
