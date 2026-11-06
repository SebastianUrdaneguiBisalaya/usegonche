import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { type Colors, radius, spacing, useColors } from '@/theme';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost';

const variantStyle = (colors: Colors, variant: Variant, pressed: boolean) => {
	switch (variant) {
		case 'primary':
			return { backgroundColor: colors.inverseBackground, borderColor: colors.inverseBackground, color: colors.inverseForeground, opacity: pressed ? 0.85 : 1 };
		case 'secondary':
			return { backgroundColor: pressed ? colors.pressed : 'transparent', borderColor: colors.borderStrong, color: colors.foreground, opacity: 1 };
		case 'ghost':
			return { backgroundColor: pressed ? colors.pressed : 'transparent', borderColor: 'transparent', color: colors.foreground, opacity: 1 };
	}
};

export type ButtonProps = {
	disabled?: boolean;
	/** Shows a spinner, blocks repeated presses and keeps `title` as the accessible label. */
	loading?: boolean;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
	title: string;
	variant?: Variant;
};

export function Button({ disabled, loading, onPress, style, title, variant = 'primary' }: ButtonProps) {
	const colors = useColors();
	const inactive = Boolean(disabled || loading);

	return (
		<Pressable
			accessibilityLabel={title}
			accessibilityRole='button'
			accessibilityState={{ busy: Boolean(loading), disabled: inactive }}
			disabled={inactive}
			onPress={onPress}
			style={({ pressed }) => {
				const v = variantStyle(colors, variant, pressed);
				return [styles.base, { backgroundColor: v.backgroundColor, borderColor: v.borderColor, opacity: disabled ? 0.4 : v.opacity }, style];
			}}
		>
			{({ pressed }) =>
				loading ? (
					<ActivityIndicator color={variantStyle(colors, variant, pressed).color} />
				) : (
					<Text style={{ color: variantStyle(colors, variant, pressed).color }} variant='bodyMedium'>
						{title}
					</Text>
				)
			}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		alignItems: 'center',
		borderCurve: 'continuous',
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		justifyContent: 'center',
		minHeight: 48,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
});
