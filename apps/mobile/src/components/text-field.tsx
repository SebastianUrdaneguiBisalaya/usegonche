import { Eye, EyeOff } from 'lucide-react-native';
import { type ComponentRef, type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { fonts, radius, spacing, useColors } from '@/theme';
import { Text } from './text';

/** What a `ref` on `TextField` points to (the native input: `focus()`, `blur()`). */
export type TextFieldRef = ComponentRef<typeof TextInput>;

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
	/** Inline message under the field; also marks it invalid for assistive technologies. */
	error?: string;
	label: string;
	ref?: Ref<TextFieldRef>;
	/** Password field: hides the text and adds a show/hide toggle. */
	secret?: boolean;
};

/** Labeled text input with an inline error. Autofill comes from the caller (`textContentType` / `autoComplete`). */
export function TextField({ error, label, ref, secret, ...props }: TextFieldProps) {
	const colors = useColors();
	const { t } = useTranslation();
	const [focused, setFocused] = useState(false);
	const [revealed, setRevealed] = useState(false);

	return (
		<View style={styles.field}>
			<Text tone='secondary' variant='label'>
				{label}
			</Text>
			<View style={[styles.box, { backgroundColor: colors.hover, borderColor: error ? colors.destructive : focused ? colors.ring : colors.border }]}>
				<TextInput
					accessibilityLabel={label}
					autoCapitalize='none'
					autoCorrect={false}
					cursorColor={colors.foreground}
					onBlur={event => {
						setFocused(false);
						props.onBlur?.(event);
					}}
					onFocus={event => {
						setFocused(true);
						props.onFocus?.(event);
					}}
					placeholderTextColor={colors.foregroundTertiary}
					ref={ref}
					secureTextEntry={secret && !revealed}
					selectionColor={colors.foreground}
					style={[styles.input, { color: colors.foreground }]}
					{...props}
				/>
				{secret ? (
					<Pressable
						accessibilityLabel={revealed ? t('auth.common.password.hide') : t('auth.common.password.show')}
						accessibilityRole='button'
						hitSlop={spacing.sm}
						onPress={() => setRevealed(value => !value)}
						style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}
					>
						{revealed ? <EyeOff color={colors.foregroundSecondary} size={20} /> : <Eye color={colors.foregroundSecondary} size={20} />}
					</Pressable>
				) : null}
			</View>
			{error ? (
				<Text accessibilityLiveRegion='polite' tone='destructive' variant='caption'>
					{error}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	box: {
		alignItems: 'center',
		borderCurve: 'continuous',
		borderRadius: radius.lg,
		borderWidth: 1,
		flexDirection: 'row',
		minHeight: 48,
		paddingHorizontal: spacing.md,
	},
	field: {
		gap: spacing.xs,
	},
	input: {
		flex: 1,
		fontFamily: fonts.body,
		fontSize: 16,
		paddingVertical: spacing.md,
	},
	toggle: {
		paddingLeft: spacing.sm,
	},
});
