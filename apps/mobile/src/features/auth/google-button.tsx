import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { getApiErrorMessage } from '@/lib/api-error';
import { spacing, useColors } from '@/theme';
import { useGoogleSignIn } from './google';

/** "or" divider + Google button, shared by sign-in and sign-up. Its error shows inline under the button. */
export function GoogleButton({ title }: { title: string }) {
	const { t } = useTranslation();
	const colors = useColors();
	const google = useGoogleSignIn();

	return (
		<View style={styles.root}>
			<View style={styles.divider}>
				<View style={[styles.line, { backgroundColor: colors.border }]} />
				<Text tone='tertiary' variant='caption'>
					{t('auth.common.or')}
				</Text>
				<View style={[styles.line, { backgroundColor: colors.border }]} />
			</View>
			<Button loading={google.isPending} onPress={() => google.mutate()} title={title} variant='secondary' />
			{google.error ? (
				<Text accessibilityLiveRegion='polite' tone='destructive' variant='subhead'>
					{getApiErrorMessage(google.error)}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	divider: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: spacing.md,
	},
	line: {
		flex: 1,
		height: StyleSheet.hairlineWidth,
	},
	root: {
		gap: spacing.lg,
	},
});
