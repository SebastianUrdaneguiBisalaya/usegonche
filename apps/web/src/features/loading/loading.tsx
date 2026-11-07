import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useEffect, useId, useRef } from 'react';

gsap.registerPlugin(DrawSVGPlugin);

/*
 * Geometry of `assets/usegonche-icon.png`, in its own 1024 x 1024 pixels, fitted to the PNG (95 % area match): a single diagonal bar
 * behind (the top of the icon and the right foot) and a "Λ" in front (left and middle feet). Both are round-capped strokes, so every
 * curve is a perfect circle arc. The front Λ cuts a thin gap into the bar behind it, which is the separation between the two pieces.
 */
/**
 * The bar's top end reaches a little further left than its axis (the short first segment), so it passes over the tip of the Λ and the
 * gap leaves the small point of the PNG where they cross.
 */
const BACK_BAR = 'M502 416 L515.5 409 L658.25 615';
const BACK_WIDTH = 136;
const FRONT_BAR = 'M356.75 616 L438 494.6 L517.9 616';
const FRONT_WIDTH = 128;
/** Gap between the two pieces, on each side of the front Λ. */
const GAP = 7;

/**
 * Full-screen loading state: the icon drawing itself, first the bar behind and then the Λ in front. Covers the whole viewport, so render it
 * conditionally while an auth step (sign in, sign up) is resolving; it is unmounted by the navigation that follows, or by the error that
 * brings the form back.
 */
export function Loading() {
	const svgRef = useRef<SVGSVGElement>(null);
	const id = useId().replace(/:/g, '');

	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;
		const ctx = gsap.context(() => {
			// A zero-length dash with round caps still paints a dot, so each bar is hidden until it starts drawing.
			const reset = { drawSVG: '0%', opacity: 0 };
			gsap.timeline({ defaults: { ease: 'power2.inOut' }, repeat: -1, repeatDelay: 0.2 })
				.set('.bar', reset)
				.set('.bar-back', { opacity: 1 })
				.to('.bar-back', { drawSVG: '100%', duration: 0.8 })
				.set('.bar-front', { opacity: 1 }, '-=0.1')
				.to('.bar-front', { drawSVG: '100%', duration: 0.9 }, '<')
				.to('.logo', { duration: 0.35, ease: 'power1.in', opacity: 0 }, '+=0.9')
				.set('.bar', reset)
				.set('.logo', { opacity: 1 });
		}, svg);
		return () => ctx.revert();
	}, []);

	return (
		<main aria-busy className='fixed inset-0 z-50 flex items-center justify-center bg-background text-foreground'>
			<svg aria-label='Loading' className='size-40 sm:size-56' ref={svgRef} role='img' viewBox='270 270 480 480'>
				<defs>
					{/* Everything but the front Λ plus its gap: keeps the bar behind out of the gap. The region is explicit so nothing gets cropped. */}
					<mask height='1024' id={`${id}-gap`} maskUnits='userSpaceOnUse' width='1024' x='0' y='0'>
						<rect fill='white' height='1024' width='1024' x='0' y='0' />
						<path className='bar bar-front' d={FRONT_BAR} fill='none' stroke='black' strokeLinecap='round' strokeLinejoin='round' strokeWidth={FRONT_WIDTH + GAP * 2} />
					</mask>
				</defs>
				<g className='logo'>
					<g mask={`url(#${id}-gap)`}>
						<path className='bar bar-back' d={BACK_BAR} fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={BACK_WIDTH} />
					</g>
					<path className='bar bar-front' d={FRONT_BAR} fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={FRONT_WIDTH} />
				</g>
			</svg>
		</main>
	);
}
