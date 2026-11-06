'use client';

import { type ReactNode, useRef } from 'react';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { LANDING_WIDTH } from '@/lib/layout';
import { type SectionMotionOptions, useSectionMotion } from '@/lib/motion/use-section-motion';

/** One block of the article (the header or a section). Each block has its own motion, so it enters when it reaches the viewport. */
function ArticleBlock({ as: Tag, children, className, trigger }: { as: 'header' | 'section'; children: ReactNode; className: string } & SectionMotionOptions) {
	const ref = useRef<HTMLElement>(null);
	useSectionMotion(ref, { trigger });
	return (
		<Tag className={className} data-motion-release ref={ref}>
			{children}
		</Tag>
	);
}

interface Section {
	paragraphs: readonly string[];
	title: string;
}

/** The article's body: one subtitle and its paragraphs per part of the Flow Cycle, then the principle that applies to all of them. */
const sections: readonly Section[] = [
	{
		paragraphs: [
			'Get everything out of your head, fast. Type a task, an idea, a note or a reference and skip the details. Everything goes to the inbox first, and nothing needs to be organized yet.',
		],
		title: 'Capture',
	},
	{
		paragraphs: ['Empty the inbox. Decide whether each item needs action and, if it does, which project it belongs to. Set a priority, a deadline or its dependencies, or drop it.'],
		title: 'Process',
	},
	{
		paragraphs: [
			'Pick today’s work against the time you really have. Check your availability and calendar events, choose what to do and, if you want, time-block it.',
			'Log progress and blockers as you go, and replan when something changes. Replanning never rewrites what already happened.',
		],
		title: 'Today',
	},
	{
		paragraphs: [
			'Review the day or the week. Compare what you planned with what you did, decide what carries over and note the blockers that keep coming back.',
			'Each review becomes the input for the next plan, so the cycle keeps going.',
		],
		title: 'Reflect',
	},
	{
		paragraphs: [
			'You can work in any stage, in any order, or skip the cycle entirely. Every suggestion shows the reason behind it, and AI only proposes: it never changes your data without your approval.',
		],
		title: 'Nothing is mandatory',
	},
];

/** "The method" article: a title, an introduction and the Flow Cycle explained section by section. */
export default function MethodPage() {
	return (
		<main className='w-full flex-1 shrink-0'>
			<Layout.Container className='pt-32 pb-24 md:pt-36' size={LANDING_WIDTH}>
				<article className='mx-auto flex max-w-2xl flex-col gap-12'>
					<ArticleBlock as='header' className='flex flex-col gap-6' trigger='load'>
						<Typography.H1 className='border-none pb-0 font-normal text-4xl leading-[1.1] tracking-tight md:text-5xl' data-motion='heading'>
							The method
						</Typography.H1>
						<Typography.Lead className='text-base text-foreground/70 leading-relaxed' data-motion='text'>
							The Flow Cycle turns messy work into concrete progress. It has four visible stages, and you can use the whole cycle or only the parts you need.
						</Typography.Lead>
					</ArticleBlock>
					{sections.map(section => (
						<ArticleBlock as='section' className='flex flex-col gap-4' key={section.title}>
							<Typography.H2 className='border-none pb-0 font-normal text-2xl tracking-tight' data-motion='heading'>
								{section.title}
							</Typography.H2>
							{section.paragraphs.map(paragraph => (
								<Typography.P className='text-foreground/70 leading-relaxed' data-motion='text' key={paragraph}>
									{paragraph}
								</Typography.P>
							))}
						</ArticleBlock>
					))}
				</article>
			</Layout.Container>
		</main>
	);
}
