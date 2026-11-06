import type { TextStyle } from 'react-native';

/**
 * Fonts embedded at build time by the `expo-font` config plugin (app.json). Static files, one per weight, so the weight is picked through
 * `fontFamily` (the PostScript name) and `fontWeight` is never set: iOS would synthesize it or fall back to the system font.
 * Manrope is for titles, IBM Plex Sans for body text (same split as the web: `--font-primary` / `--font-secondary`).
 */
export const fonts = {
	body: 'IBMPlexSans-Regular',
	bodyItalic: 'IBMPlexSans-Italic',
	bodyMedium: 'IBMPlexSans-Medium',
	bodySemiBold: 'IBMPlexSans-SemiBold',
	title: 'Manrope-Bold',
	titleSemiBold: 'Manrope-SemiBold',
} as const;

/** Named text styles; screens pick a variant of `<Text>` instead of setting sizes. Colors are applied by `<Text>` (they depend on the scheme). */
export const type = {
	largeTitle: { fontFamily: fonts.title, fontSize: 30, letterSpacing: -0.4, lineHeight: 36 },
	title: { fontFamily: fonts.title, fontSize: 22, letterSpacing: -0.2, lineHeight: 28 },
	headline: { fontFamily: fonts.titleSemiBold, fontSize: 17, lineHeight: 22 },
	body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
	bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
	label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
	subhead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
	caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;
