import type { ReactNode } from 'react';
import LandingFooter from '@/features/landing/footer';
import LandingNavbar from '@/features/landing/navbar';
import { MotionScope } from '@/lib/motion/motion-scope';

/** Shared shell of the public landing routes (`/` and `/method`): the floating navbar on top, the footer below. */
export default function LandingLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<LandingNavbar />
			{children}
			{/* The body centers its children; this wrapper keeps the footer full width. The footer enters like any other text block. */}
			<MotionScope className='w-full shrink-0'>
				<div data-motion='text'>
					<LandingFooter />
				</div>
			</MotionScope>
		</>
	);
}
