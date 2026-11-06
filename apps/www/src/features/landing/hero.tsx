'use client';

import { ArrowRight, Download } from 'lucide-react';
import { buttonVariants } from '@/components/ui/actions-controls/button/button';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { SIGN_UP_URL } from '@/lib/links';
import { glass } from '@/styles/glass';
import HeroMockup from './hero-mockup';

/** Full-screen hero: the GONCHE motto, the pitch and the two CTAs next to the app preview, vertically centered over the background artwork. Below `xl` the preview stacks under the text. */
export default function Hero() {
	return (
		<section className="relative min-h-svh w-full bg-[url('/bg-usegonche-dark.png')] bg-cover bg-center" id='hero'>
			{/* Fades the artwork into the page background so the next section doesn't start on a hard edge. */}
			<div aria-hidden className='pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-background md:h-56' />
			<Layout.Container
				className='relative flex min-h-svh flex-col justify-center gap-14 pt-28 pb-16 xl:h-svh xl:flex-row xl:items-start xl:justify-start xl:gap-10 xl:pt-32 xl:pb-10'
				size={LANDING_WIDTH}
			>
				<Layout.Stack className='max-w-2xl shrink-0 xl:w-[44%]' gap='xl'>
					<Typography.H1 className='font-normal text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl'>
						<span className='block'>Get Organized,</span>
						<span className='block'>Never Compromise,</span>
						<span className='block text-foreground/60'>Hustle Efficiently.</span>
					</Typography.H1>
					<Typography.Lead className='max-w-md text-base text-foreground/70 leading-relaxed'>
						Turn scattered thoughts, tasks and plans into concrete progress. Know what to do, when to do it, and how.
					</Typography.Lead>
					<Layout.HStack className='mt-4 flex-wrap' gap='md'>
						<a className={cn(buttonVariants.root({ variant: 'primary' }), 'rounded-full px-6 py-3')} href={SIGN_UP_URL}>
							<Typography.Small className='text-background'>Get started free</Typography.Small>
							<Icon aria-hidden='true' className='text-background' icon={ArrowRight} size='sm' />
						</a>
						<a className={cn(buttonVariants.root({ variant: 'secondary' }), glass.pill, 'px-6 py-3')} href='#desktop'>
							<Icon aria-hidden='true' icon={Download} size='sm' />
							<Typography.Small>Download for desktop</Typography.Small>
						</a>
					</Layout.HStack>
				</Layout.Stack>
				<HeroMockup className='mx-auto min-w-0 max-w-3xl xl:max-w-none xl:flex-1' />
			</Layout.Container>
		</section>
	);
}
