import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, useColors } from '@/theme';

/**
 * Full-screen container for forms: safe area, theme background, keyboard avoidance and a scroll view that keeps taps working while
 * the keyboard is up. Screens with a native header pass `edges` without `top` (the header already covers it).
 */
export function Screen({ children, edges = ['top', 'bottom'] }: { children: ReactNode; edges?: ('top' | 'bottom')[] }) {
	const colors = useColors();
	return (
		<SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
				<ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior='automatic' keyboardShouldPersistTaps='handled'>
					{children}
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	content: {
		flexGrow: 1,
		gap: spacing.xl,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.xl,
	},
	root: {
		flex: 1,
	},
});
