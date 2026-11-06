import Desktop from '@/features/landing/desktop';
import Faq from '@/features/landing/faq';
import Features from '@/features/landing/features';
import Hero from '@/features/landing/hero';
import HowItWorks from '@/features/landing/how-it-works';
import WhyGonche from '@/features/landing/why-gonche';

export default function LandingPage() {
	return (
		<main className='flex w-full flex-1 shrink-0 flex-col gap-4 md:gap-8 lg:gap-12'>
			<Hero />
			<HowItWorks />
			<Features />
			<WhyGonche />
			<Desktop />
			<Faq />
		</main>
	);
}
