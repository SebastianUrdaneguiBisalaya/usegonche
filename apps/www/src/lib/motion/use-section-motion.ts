'use client';

import type { RefObject } from 'react';
import { useIsomorphicLayoutEffect } from '@/components/ui/hooks/useIsomorphicLayoutEffect';
import { gsap, playEntrance, playRelease } from './presets';

export interface SectionMotionOptions {
	/**
	 * `load`: the entrance plays as soon as the page is ready (the hero, the navbar, the first screen).
	 * `scroll`: the entrance plays once, when the block comes into view.
	 * @default 'scroll'
	 */
	trigger?: 'load' | 'scroll';
}

/**
 * Gives a block the landing's motion: its `data-motion` elements enter with the shared presets (see `presets.ts`), and its
 * `data-motion-release` element lifts out while the user scrolls past it. Honors `prefers-reduced-motion` by not animating at all.
 * Reverts every tween and ScrollTrigger on unmount, so it is safe under React's Strict Mode double mount.
 */
export function useSectionMotion<T extends HTMLElement>(scope: RefObject<T | null>, { trigger = 'scroll' }: SectionMotionOptions = {}) {
	useIsomorphicLayoutEffect(() => {
		const root = scope.current;
		if (!root) return;

		const media = gsap.matchMedia();
		media.add('(prefers-reduced-motion: no-preference)', () => {
			const isLoad = trigger === 'load';
			playEntrance(root, { delay: isLoad ? 0.2 : 0, scrollTrigger: !isLoad });
			playRelease(root);
		});

		return () => media.revert();
	}, [scope, trigger]);
}
