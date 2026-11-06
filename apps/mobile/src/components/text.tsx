import { Text as NativeText, type TextProps as NativeTextProps, StyleSheet } from 'react-native';
import { type Colors, type TextVariant, type, useColors } from '@/theme';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'success';

const toneColor = (colors: Colors, tone: Tone): string =>
	({
		destructive: colors.destructive,
		primary: colors.foreground,
		secondary: colors.foregroundSecondary,
		success: colors.success,
		tertiary: colors.foregroundTertiary,
	})[tone];

export type TextProps = NativeTextProps & { tone?: Tone; variant?: TextVariant };

/** Every text in the app: a named variant of the type ramp plus a semantic tone. Screens never set font sizes or families. */
export function Text({ style, tone = 'primary', variant = 'body', ...props }: TextProps) {
	const colors = useColors();
	return <NativeText style={[styles.base, type[variant], { color: toneColor(colors, tone) }, style]} {...props} />;
}

const styles = StyleSheet.create({
	base: {
		includeFontPadding: false,
	},
});
