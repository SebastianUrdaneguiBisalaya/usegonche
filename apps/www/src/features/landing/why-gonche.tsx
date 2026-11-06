'use client';

import { CalendarClock, type LucideIcon, ShieldCheck, User, Zap } from 'lucide-react';
import { useRef } from 'react';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { useSectionMotion } from '@/lib/motion/use-section-motion';
import { glass } from '@/styles/glass';

/** Product principles (manual-first, AI only proposes, single user, planning against real capacity). */
const reasons: readonly { description: string; icon: LucideIcon; title: string }[] = [
	{ description: 'Works fully without AI.', icon: Zap, title: 'Manual-first' },
	{ description: 'Nothing changes without your permission.', icon: ShieldCheck, title: 'You stay in control' },
	{ description: 'No teams, no noise, just your work.', icon: User, title: 'Built for one person' },
	{ description: 'Plan around your availability, calendar and estimates.', icon: CalendarClock, title: 'Real capacity' },
];

/** "Why Gonche": the mountain artwork on the left fading into the page, the principles on the right. */
export default function WhyGonche() {
	const ref = useRef<HTMLElement>(null);
	useSectionMotion(ref);

	return (
		<section className='relative w-full scroll-mt-24 overflow-hidden' id='why-gonche' ref={ref}>
			{/* Artwork: a band on top on mobile, the left half from `lg`. */}
			<div aria-hidden className="absolute inset-x-0 top-0 h-72 bg-[url('/bg-mountain.png')] bg-center bg-cover sm:h-96 lg:inset-y-0 lg:right-auto lg:h-auto lg:w-[55%]" data-motion='media'>
				<div className='absolute inset-0 bg-linear-to-b from-transparent from-40% to-background lg:bg-linear-to-r lg:from-60%' />
				<div className='absolute inset-x-0 top-0 h-24 bg-linear-to-t from-transparent to-background' />
				<div className='absolute inset-x-0 bottom-0 hidden h-24 bg-linear-to-b from-transparent to-background lg:block' />
			</div>
			<Layout.Container className='relative flex pt-56 pb-12 sm:pt-80 lg:min-h-[480px] lg:items-center lg:py-24' data-motion-release size={LANDING_WIDTH}>
				<Layout.Stack className='w-full lg:ml-auto lg:w-1/2' gap='lg'>
					<Pill className={cn(glass.surface, 'self-start px-4 py-1.5')} data-motion='item' variant='outline'>
						<Pill.Text className='text-[11px] uppercase tracking-[0.2em]'>Why Gonche</Pill.Text>
					</Pill>
					<Typography.H2 className='border-none pb-0 font-normal text-3xl leading-[1.15] tracking-tight md:text-5xl'>
						<span className='block' data-motion='heading'>
							A calmer mind.
						</span>
						<span className='block text-foreground/60' data-motion='heading'>
							A more productive you.
						</span>
					</Typography.H2>
					<ul className='mt-4 grid list-none grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2'>
						{reasons.map(reason => (
							<li key={reason.title}>
								<Layout.HStack align='center' gap='md'>
									{/* Same glass circle as the "How it works" steps. */}
									<span className={cn(glass.surface, 'flex size-14 shrink-0 items-center justify-center rounded-full')} data-motion='badge'>
										<Icon aria-hidden='true' icon={reason.icon} size='xl' />
									</span>
									<Layout.Stack data-motion='text' gap='xs'>
										<Typography.Small className='font-medium'>{reason.title}</Typography.Small>
										<Typography.Muted className='text-foreground/60 leading-relaxed'>{reason.description}</Typography.Muted>
									</Layout.Stack>
								</Layout.HStack>
							</li>
						))}
					</ul>
				</Layout.Stack>
			</Layout.Container>
		</section>
	);
}
