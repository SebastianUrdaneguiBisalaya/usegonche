import type { ReactNode } from 'react';
import LandingFooter from '@/features/landing/footer';
import LandingNavbar from '@/features/landing/navbar';

/** Shared shell of the public landing routes (`/` and `/method`): the floating navbar on top, the footer below. */
export default function LandingLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<LandingNavbar />
			{children}
			{/* The body centers its children; this wrapper keeps the footer full width. */}
			<div className='w-full shrink-0'>
				<LandingFooter />
			</div>
		</>
	);
}
