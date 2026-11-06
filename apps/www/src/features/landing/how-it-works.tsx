'use client';

import { CalendarDays, ChartNoAxesColumnIncreasing, Check, type LucideIcon, Plus } from 'lucide-react';
import { useRef } from 'react';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { useSectionMotion } from '@/lib/motion/use-section-motion';
import { glass } from '@/styles/glass';

/** The four visible stages of the Flow Cycle (Capture, Process, Today, Reflect). */
const stages: readonly { description: string; icon: LucideIcon; title: string }[] = [
	{ description: 'Jot down anything in seconds (a task, an idea, a note, a reference).', icon: Plus, title: 'Capture' },
	{ description: 'Empty your inbox by deciding what each item is, which project it belongs to and its priority.', icon: Check, title: 'Process' },
	{ description: 'Plan your day around your real capacity, with optional time blocks.', icon: CalendarDays, title: 'Today' },
	{ description: 'Run your weekly review to see what you achieved and what comes next.', icon: ChartNoAxesColumnIncreasing, title: 'Reflect' },
];

/** "How it works": the Flow Cycle in four steps. */
export default function HowItWorks() {
	const ref = useRef<HTMLElement>(null);
	useSectionMotion(ref);

	return (
		<section className='w-full scroll-mt-24 py-12 md:py-16' id='how-it-works' ref={ref}>
			<Layout.Container className='flex flex-col items-center gap-10 md:gap-12' data-motion-release size={LANDING_WIDTH}>
				<Layout.Stack align='center' gap='md'>
					<Pill className={cn(glass.surface, 'px-4 py-1.5')} data-motion='item' variant='outline'>
						<Pill.Text className='text-[11px] uppercase tracking-[0.2em]'>How it works</Pill.Text>
					</Pill>
					<Typography.H2 className='border-none pb-0 text-center font-normal text-3xl tracking-tight md:text-4xl' data-motion='heading'>
						A simple cycle. Big results.
					</Typography.H2>
				</Layout.Stack>
				<ol className='grid w-full list-none grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8'>
					{stages.map((stage, i) => (
						<li className='flex flex-col items-center gap-4 text-center' key={stage.title}>
							<span className={cn(glass.surface, 'flex size-14 items-center justify-center rounded-full')} data-motion='badge'>
								<Icon aria-hidden='true' icon={stage.icon} size='xl' />
							</span>
							<Layout.Stack align='center' data-motion='text' gap='sm'>
								<Typography.H3 className='font-medium text-lg'>
									{i + 1}. {stage.title}
								</Typography.H3>
								<Typography.Muted className='max-w-64 text-foreground/65 leading-relaxed'>{stage.description}</Typography.Muted>
							</Layout.Stack>
						</li>
					))}
				</ol>
				<Layout.Stack align='center' gap='md'>
					<Typography.Muted className='text-center text-foreground/75' data-motion='text'>
						Nothing is mandatory. Use the full cycle or just the parts you need.
					</Typography.Muted>
					<a className={cn(glass.pill, 'px-5 py-2.5 text-sm font-medium')} data-motion='item' href='/method'>
						Read the method
					</a>
				</Layout.Stack>
			</Layout.Container>
		</section>
	);
}
