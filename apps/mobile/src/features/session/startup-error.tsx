import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { spacing, useColors } from '@/theme';

/** Signed in but the account settings could not be loaded (offline, server down): without them the app cannot pick the right screen. */
export function StartupError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
	const { t } = useTranslation();
	const colors = useColors();
	return (
		<SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
			<View style={styles.content}>
				<Text style={styles.center} tone='secondary'>
					{t('mobile.errors.network')}
				</Text>
				<Button loading={retrying} onPress={onRetry} title={t('mobile.startup.retry')} variant='secondary' />
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	center: {
		textAlign: 'center',
	},
	content: {
		gap: spacing.lg,
		paddingHorizontal: spacing.xl,
	},
	root: {
		flex: 1,
		justifyContent: 'center',
	},
});
