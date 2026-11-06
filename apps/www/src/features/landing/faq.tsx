'use client';

import { Accordion } from '@/components/ui/data-display/accordion/accordion';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Layout } from '@/components/ui/layout/layout/layout';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { glass } from '@/styles/glass';

interface Question {
	answer: string;
	question: string;
	value: string;
}

/** Split in two columns, like the reference layout. Answers stick to what the product does today. */
const columns: readonly (readonly Question[])[] = [
	[
		{
			answer: 'No. useGonche works fully by hand. Any AI help is optional and only proposes changes; nothing touches your data without your approval.',
			question: 'Do I need AI to use it?',
			value: 'ai',
		},
		{
			answer: 'No. It is a personal productivity app built for one person: your tasks, your projects, your day. There are no workspaces, roles or shared boards.',
			question: 'Is it for teams?',
			value: 'teams',
		},
		{
			answer: 'Your data lives in a managed Postgres database and your files in private storage, both tied to your account. Only you can read them.',
			question: 'Where is my data stored?',
			value: 'data',
		},
		{
			answer: 'No. Capture, Process, Today and Reflect are there when you want them. Use the full cycle or just the parts you need, and work manually at any time.',
			question: 'Do I have to follow the whole Flow Cycle?',
			value: 'flow-cycle',
		},
	],
	[
		{
			answer: 'Yes. There is a native app for macOS and an Android app to capture and close the day on the go, all in sync with the web app.',
			question: 'Does it have a desktop app?',
			value: 'desktop',
		},
		{
			answer: 'GitHub comes first, followed by Google Calendar, Google Drive, Notion, Gmail and Slack. Integrations bring work in without turning it into tasks until you decide to.',
			question: 'What integrations are available?',
			value: 'integrations',
		},
		{
			answer: 'Yes. Set reminders on any task, event or note. They show up inside the app, independent of due dates.',
			question: 'Can it remind me of things?',
			value: 'reminders',
		},
		{
			answer: 'Yes. You can get started for free.',
			question: 'Is it free?',
			value: 'free',
		},
	],
];

/** FAQ: a label on the left and two accordion columns, placed right before the footer. */
export default function Faq() {
	return (
		<section aria-labelledby='faq-label' className='w-full scroll-mt-24 py-12 md:py-16' id='faq'>
			<Layout.Container className='flex flex-col gap-8 lg:flex-row lg:gap-16' size={LANDING_WIDTH}>
				<div className='shrink-0 lg:w-24'>
					<Pill className={cn(glass.surface, 'px-4 py-1.5')} variant='outline'>
						<Pill.Text className='text-[11px] uppercase tracking-[0.2em]' id='faq-label'>
							FAQ
						</Pill.Text>
					</Pill>
				</div>
				<Layout.Grid className='min-w-0 flex-1' cols={{ base: 1, md: 2 }} gap={{ base: 'none', md: 'xl' }}>
					{columns.map((questions, i) => (
						<Accordion
							// On mobile the columns stack into a single list, so only the first one draws the top line.
							className={cn('border-white/10 border-t', i > 0 && 'border-t-0 md:border-t')}
							key={questions[0]?.value}
							type='single'
						>
							{questions.map(item => (
								<Accordion.Item className='border-white/10 last:border-b' key={item.value} value={item.value}>
									<Accordion.Trigger className='rounded-none py-3 pr-3 font-normal text-foreground/80 hover:text-foreground' headingLevel={3}>
										{item.question}
									</Accordion.Trigger>
									<Accordion.Content className='pr-8 text-foreground/60 leading-relaxed'>{item.answer}</Accordion.Content>
								</Accordion.Item>
							))}
						</Accordion>
					))}
				</Layout.Grid>
			</Layout.Container>
		</section>
	);
}
