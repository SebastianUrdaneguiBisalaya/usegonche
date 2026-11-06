import { useColorScheme } from 'react-native';

/**
 * Mirror of the semantic tokens in `apps/web/src/app/app.css` (Scandinavian neutral foundation). Keep both in sync.
 * The color scheme comes from `useColorScheme()`, which follows the device or the account's theme (see `useApplyAccountSettings`).
 */
const light = {
	background: '#f5f5f3',
	border: 'rgba(11, 11, 11, 0.10)',
	borderStrong: 'rgba(11, 11, 11, 0.18)',
	destructive: '#eb5757',
	destructiveForeground: '#f5f5f3',
	foreground: '#0b0b0b',
	foregroundSecondary: 'rgba(11, 11, 11, 0.64)',
	foregroundTertiary: 'rgba(11, 11, 11, 0.44)',
	hover: 'rgba(11, 11, 11, 0.05)',
	inverseBackground: '#0b0b0b',
	inverseForeground: '#f5f5f3',
	overlay: 'rgba(0, 0, 0, 0.44)',
	pressed: 'rgba(11, 11, 11, 0.09)',
	ring: '#0b0b0b',
	success: '#2f9e44',
	successForeground: '#f5f5f3',
	warning: '#b8860b',
	warningForeground: '#f5f5f3',
};

export type Colors = typeof light;

const dark: Colors = {
	background: '#0b0b0b',
	border: 'rgba(245, 245, 243, 0.10)',
	borderStrong: 'rgba(245, 245, 243, 0.18)',
	destructive: '#f27979',
	destructiveForeground: '#f5f5f3',
	foreground: '#f5f5f3',
	foregroundSecondary: 'rgba(245, 245, 243, 0.60)',
	foregroundTertiary: 'rgba(245, 245, 243, 0.38)',
	hover: 'rgba(245, 245, 243, 0.07)',
	inverseBackground: '#f5f5f3',
	inverseForeground: '#0b0b0b',
	overlay: 'rgba(0, 0, 0, 0.44)',
	pressed: 'rgba(245, 245, 243, 0.12)',
	ring: '#f5f5f3',
	success: '#51c96a',
	successForeground: '#f5f5f3',
	warning: '#e0a916',
	warningForeground: '#f5f5f3',
};

export const palettes = { dark, light } as const;

/** The palette of the current color scheme. Colors are only applied at render time (they depend on the scheme). */
export function useColors(): Colors {
	return useColorScheme() === 'dark' ? dark : light;
}
