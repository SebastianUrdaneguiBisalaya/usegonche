import LandingFooter from '@/features/landing/footer';
import Hero from '@/features/landing/hero';
import HowItWorks from '@/features/landing/how-it-works';
import LandingNavbar from '@/features/landing/navbar';

export default function LandingPage() {
	return (
		<>
			<LandingNavbar />
			<main className='flex w-full flex-1 shrink-0 flex-col gap-4 md:gap-8 lg:gap-12'>
				<Hero />
				<HowItWorks />
			</main>
			{/* The body centers its children; this wrapper keeps the footer full width. */}
			<div className='w-full shrink-0'>
				<LandingFooter />
			</div>
		</>
	);
}
