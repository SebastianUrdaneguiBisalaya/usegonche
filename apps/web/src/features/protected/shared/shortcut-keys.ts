import { formatHotkey } from '@usehotkeys/core';

/**
 * Keys to render as `Kbd`s for a combo, in the visitor's platform (the library detects it): `mod+k` gives `⌘ K` on macOS and `Ctrl K`
 * on Windows and Linux. A sequence (`g i`) keeps one key per step.
 */
export function shortcutKeys(combo: string): string[] {
	const text = formatHotkey(combo);
	if (text.includes(' ')) return text.split(' ');
	if (text.includes('+')) return text.split('+');
	return [...text];
}
