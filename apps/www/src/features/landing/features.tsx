'use client';

import { Check } from 'lucide-react';
import type { ComponentType } from 'react';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { glass } from '@/styles/glass';
import { CaptureMockup, PlanMockup, ReflectMockup } from './feature-mockups';

interface Feature {
	description: string;
	label: string;
	mockup: ComponentType<{ className?: string }>;
	/** What the user can do, each one checked against `apps/web`. */
	points: readonly string[];
	title: string;
}

const features: readonly Feature[] = [
	{
		description: 'Pick today’s work against the time you really have. Your working hours and calendar events set your capacity.',
		label: 'Plan and execute',
		mockup: PlanMockup,
		points: ['Tasks with subtasks, dependencies and blockers', 'A daily plan with optional time blocks', 'Calendar events and working hours', 'Recurring tasks and reminders'],
		title: 'Plan your day around real capacity.',
	},
	{
		description: 'Get everything out of your head first. Decide later what each item is and where it belongs.',
		label: 'Capture and organize',
		mockup: CaptureMockup,
		points: [
			'Quick capture and Brain Dump, one idea per line',
			'Turn inbox items into tasks, projects or notes',
			'Projects linked to goals, with tags',
			'Notes with attachments, all one search away',
		],
		title: 'Capture now, organize later.',
	},
	{
		description: 'Daily and weekly reviews that end in decisions, not in reports you have to maintain.',
		label: 'Reflect',
		mockup: ReflectMockup,
		points: [
			'Planned vs completed, with your completion rate',
			'Carry over, reschedule, drop or keep what is pending',
			'Blockers that keep coming back',
			'A history of every change to your tasks',
		],
		title: 'Learn from every week.',
	},
];

function FeatureRow({ feature, reversed }: { feature: Feature; reversed: boolean }) {
	const Mockup = feature.mockup;
	return (
		<article className='grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16'>
			<Layout.Stack className={cn('max-w-md', reversed && 'lg:order-2')} gap='lg'>
				<Pill className={cn(glass.surface, 'px-4 py-1.5')} variant='outline'>
					<Pill.Text className='text-[11px] uppercase tracking-[0.2em]'>{feature.label}</Pill.Text>
				</Pill>
				<Typography.H3 className='font-normal text-3xl leading-[1.15] tracking-tight md:text-4xl'>{feature.title}</Typography.H3>
				<Typography.P className='mt-0 text-base text-foreground/65 leading-relaxed [&:not(:first-child)]:mt-0'>{feature.description}</Typography.P>
				<Typography.List className='my-0 ml-0 flex list-none flex-col gap-3 [&>li]:mt-0'>
					{feature.points.map(point => (
						<li className='flex items-start gap-3' key={point}>
							<Icon aria-hidden='true' className='mt-0.5 shrink-0 text-foreground/70' icon={Check} size='sm' />
							<Typography.Span className='text-foreground/80 text-sm leading-relaxed'>{point}</Typography.Span>
						</li>
					))}
				</Typography.List>
			</Layout.Stack>
			<Mockup className={cn(reversed && 'lg:order-1')} />
		</article>
	);
}

/** Features: the three parts of the Flow Cycle, each one next to a preview built from the web app's real screens. */
export default function Features() {
	return (
		<section className='w-full scroll-mt-24 py-16 md:py-24' id='features'>
			<Layout.Container className='flex flex-col items-center gap-14 md:gap-20' size={LANDING_WIDTH}>
				<Layout.Stack align='center' gap='md'>
					<Pill className={cn(glass.surface, 'px-4 py-1.5')} variant='outline'>
						<Pill.Text className='text-[11px] uppercase tracking-[0.2em]'>Features</Pill.Text>
					</Pill>
					<Typography.H2 className='border-none pb-0 text-center font-normal text-3xl tracking-tight md:text-4xl'>Everything your day needs. Nothing it doesn’t.</Typography.H2>
				</Layout.Stack>
				<div className='flex w-full flex-col gap-24 md:gap-32'>
					{features.map((feature, i) => (
						<FeatureRow feature={feature} key={feature.label} reversed={i % 2 === 1} />
					))}
				</div>
			</Layout.Container>
		</section>
	);
}
