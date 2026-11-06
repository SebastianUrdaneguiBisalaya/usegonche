import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { spacing } from '@/theme';

/** Title + optional description at the top of every auth screen. */
export function AuthHeader({ description, title }: { description?: string; title: string }) {
	return (
		<View style={styles.header}>
			<Text accessibilityRole='header' variant='largeTitle'>
				{title}
			</Text>
			{description ? <Text tone='secondary'>{description}</Text> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		gap: spacing.sm,
	},
});
