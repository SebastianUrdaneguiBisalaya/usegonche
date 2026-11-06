'use client';

import 'lenis/dist/lenis.css';
import { ReactLenis, useLenis } from 'lenis/react';
import type { ReactNode } from 'react';
import { ScrollTrigger } from '@/lib/motion/presets';

/** Keeps the GSAP ScrollTrigger positions in step with Lenis' smoothed scroll, so scroll-tied motion never lags behind the page. */
function ScrollTriggerSync() {
	useLenis(() => {
		ScrollTrigger.update();
	});
	return null;
}

/**
 * Smooth scroll for the whole page (a single root Lenis instance driving the window scroll).
 * - `autoRaf`: Lenis runs its own `requestAnimationFrame` loop.
 * - `anchors`: clicks on in-page links (`#features`, `#faq`, ...) glide to the section instead of jumping. Lenis honors each
 *   section's `scroll-margin-top` (`scroll-mt-24`), so they still land below the fixed navbar.
 * Lenis already falls back to native scrolling when the user prefers reduced motion.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
	return (
		<ReactLenis options={{ anchors: true, autoRaf: true }} root>
			<ScrollTriggerSync />
			{children}
		</ReactLenis>
	);
}
