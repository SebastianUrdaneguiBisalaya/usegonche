import { Text } from '@/components/text';
import { getApiErrorMessage } from '@/lib/api-error';

/** The localized API error of a submit, announced to screen readers. Nothing while there is none. */
export function FormError({ error }: { error: unknown }) {
	if (!error) return null;
	return (
		<Text accessibilityLiveRegion='polite' accessibilityRole='alert' tone='destructive' variant='subhead'>
			{getApiErrorMessage(error)}
		</Text>
	);
}
