import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/**
 * Motion language of the landing. Every block uses these presets, so the whole page moves as one system.
 *
 * - Entrance: content comes in from below and settles with a soft overshoot. Headings unveil line by line from a clip, panels tilt
 *   up into place like a window set on a desk, badges pop, labels and rows slide in from the side. Plays once per block.
 * - Exit: as the user scrolls past a block, its content lifts up and dissolves. It is tied to the scroll, so it reverses when the
 *   user scrolls back.
 *
 * The two directions are opposite on purpose: things arrive from below and leave upward.
 */

/** What an element is, which decides its entrance. Mark elements with `data-motion="<kind>"`. */
export type MotionKind = 'badge' | 'heading' | 'item' | 'surface' | 'text';

interface EnterSpec {
	/** Seconds from the start of the block's entrance when this kind begins. */
	at: number;
	duration: number;
	ease: string;
	from: gsap.TweenVars;
	/** Delay between elements of the same kind. */
	stagger: number;
	to: gsap.TweenVars;
}

export const ENTER: Record<MotionKind, EnterSpec> = {
	badge: {
		at: 0.3,
		duration: 1,
		ease: 'back.out(1.8)',
		from: { opacity: 0, rotate: -45, scale: 0.4 },
		stagger: 0.1,
		to: { opacity: 1, rotate: 0, scale: 1 },
	},
	heading: {
		at: 0.05,
		duration: 1.2,
		ease: 'expo.out',
		from: { clipPath: 'inset(0% 0% 100% 0%)', opacity: 0, yPercent: 35 },
		stagger: 0.09,
		to: { clipPath: 'inset(0% 0% 0% 0%)', clearProps: 'clipPath', opacity: 1, yPercent: 0 },
	},
	item: {
		at: 0.36,
		duration: 0.9,
		ease: 'power3.out',
		from: { opacity: 0, x: -32 },
		stagger: 0.08,
		to: { opacity: 1, x: 0 },
	},
	surface: {
		at: 0.15,
		duration: 1.6,
		ease: 'expo.out',
		from: { opacity: 0, rotateX: 16, scale: 0.92, transformOrigin: '50% 100%', transformPerspective: 1400, y: 110 },
		stagger: 0.14,
		to: { opacity: 1, rotateX: 0, scale: 1, y: 0 },
	},
	text: {
		at: 0.28,
		duration: 1,
		ease: 'power3.out',
		from: { opacity: 0, y: 28 },
		stagger: 0.1,
		to: { opacity: 1, y: 0 },
	},
};

/** Exit: applied to the block's `data-motion-release` element, scrubbed from the moment its bottom edge reaches 45% of the viewport. */
export const RELEASE_FROM = { opacity: 1, scale: 1, y: 0 } satisfies gsap.TweenVars;
export const RELEASE_TO = { opacity: 0, scale: 0.96, y: -90 } satisfies gsap.TweenVars;

/** Background artwork: scales from a slight zoom into place, once, on entrance. */
export const MEDIA_ENTER = {
	duration: 2.4,
	ease: 'power2.out',
	from: { opacity: 0, scale: 1.1 },
	to: { opacity: 1, scale: 1 },
} satisfies { duration: number; ease: string; from: gsap.TweenVars; to: gsap.TweenVars };

/** Attribute marking a block that runs its own motion. A block only animates the elements that are not inside a nested block. */
export const SCOPE_ATTRIBUTE = 'data-motion-scope';

/** `data-motion` elements of `root` that belong to it (not to a nested scope such as a feature row inside the features section). */
function ownedElements(root: HTMLElement, kind: string): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(`[data-motion="${kind}"]`)).filter(el => el.closest(`[${SCOPE_ATTRIBUTE}]`) === root);
}

/** Plays the entrance of every `data-motion` element owned by `root` on one timeline. Returns the timeline (kill it to clean up). */
export function playEntrance(root: HTMLElement, options: { delay?: number; scrollTrigger?: boolean }): gsap.core.Timeline {
	root.setAttribute(SCOPE_ATTRIBUTE, '');
	const timeline = gsap.timeline({
		delay: options.delay ?? 0,
		...(options.scrollTrigger ? { scrollTrigger: { once: true, start: 'top 78%', trigger: root } } : {}),
	});

	for (const media of ownedElements(root, 'media')) {
		timeline.fromTo(media, MEDIA_ENTER.from, { ...MEDIA_ENTER.to, duration: MEDIA_ENTER.duration, ease: MEDIA_ENTER.ease }, 0);
	}

	for (const kind of Object.keys(ENTER) as MotionKind[]) {
		const elements = ownedElements(root, kind);
		if (elements.length === 0) continue;
		const spec = ENTER[kind];
		timeline.fromTo(elements, spec.from, { ...spec.to, duration: spec.duration, ease: spec.ease, stagger: spec.stagger }, spec.at);
	}

	return timeline;
}

/** Scrubbed exit of a block. The release target is the block itself or its first `data-motion-release` descendant. */
export function playRelease(root: HTMLElement): gsap.core.Tween | undefined {
	const target = root.matches('[data-motion-release]') ? root : root.querySelector<HTMLElement>('[data-motion-release]');
	if (!target) return undefined;

	return gsap.fromTo(target, RELEASE_FROM, {
		...RELEASE_TO,
		ease: 'none',
		scrollTrigger: { end: 'bottom top', scrub: true, start: 'bottom 45%', trigger: root },
	});
}
