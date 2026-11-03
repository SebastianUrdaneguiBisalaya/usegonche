import { useSyncExternalStore } from 'react';

/** Whether a CSS media query matches. `serverValue` is what the server render assumes (and the first client paint, until it hydrates). */
export function useMediaQuery(query: string, serverValue = false): boolean {
	return useSyncExternalStore(
		onChange => {
			const list = window.matchMedia(query);
			list.addEventListener('change', onChange);
			return () => list.removeEventListener('change', onChange);
		},
		() => window.matchMedia(query).matches,
		() => serverValue
	);
}
