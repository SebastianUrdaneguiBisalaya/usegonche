'use client';

import { AppleLight, Windows } from '@ridemountainpig/svgl-react';
import { useRef } from 'react';
import { buttonVariants } from '@/components/ui/actions-controls/button/button';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { MACOS_DOWNLOAD_URL, WINDOWS_DOWNLOAD_URL } from '@/lib/links';
import { useSectionMotion } from '@/lib/motion/use-section-motion';
import { glass } from '@/styles/glass';
import { ScaledCanvas } from './mockup';
import { TodayScreen } from './today-screen';

/** The laptop's screen is drawn at a real app size (like a 1360px wide window) and the whole laptop is scaled down to fit its column. */
const SCREEN = { height: 800, width: 1360 } as const;
const BEZEL = 16;
const LID = { height: SCREEN.height + BEZEL * 2, width: SCREEN.width + BEZEL * 2 } as const;
/** Shorter than the lid, so the section's bottom edge cuts the laptop like in a product shot. */
const CANVAS_HEIGHT = 700;

/** A laptop lid (bezel and camera) around the app; only the top of it fits the canvas. */
function Laptop({ className }: { className?: string }) {
	return (
		<ScaledCanvas className={className} frameClassName='overflow-hidden lg:mr-0' height={CANVAS_HEIGHT} width={LID.width}>
			<div
				className='absolute inset-x-0 top-0 flex flex-col rounded-t-[36px] border border-white/15 bg-neutral-900 shadow-[0_-20px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]'
				style={{ height: LID.height, padding: BEZEL }}
			>
				<span aria-hidden className='-translate-x-1/2 absolute top-[5px] left-1/2 size-1.5 rounded-full bg-white/25' />
				<div className='min-h-0 flex-1 overflow-hidden rounded-t-[20px] border border-white/5 bg-black'>
					<TodayScreen />
				</div>
			</div>
		</ScaledCanvas>
	);
}

/** Desktop section: the native apps (macOS and Windows) next to the desktop app on a laptop, over the hero artwork anchored to the left. */
export default function Desktop() {
	const ref = useRef<HTMLElement>(null);
	useSectionMotion(ref);

	return (
		<section className='relative w-full scroll-mt-24 overflow-hidden' id='desktop' ref={ref}>
			<div aria-hidden className="absolute inset-0 bg-[url('/bg-usegonche-dark.png')] bg-cover bg-left" data-motion='media' />
			{/* Fades the artwork in and out of the page background, like the hero's bottom edge. */}
			<div aria-hidden className='pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-t from-transparent to-background' />
			<Layout.Container className='relative flex flex-col gap-14 pt-24 lg:flex-row lg:items-end lg:gap-10 lg:pt-32' data-motion-release size={LANDING_WIDTH}>
				<Layout.Stack className='max-w-xl shrink-0 lg:w-[36%] lg:self-center lg:pb-16' gap='lg'>
					<Pill className={cn(glass.surface, 'px-4 py-1.5')} data-motion='item' variant='outline'>
						<Pill.Text className='text-[11px] uppercase tracking-[0.2em]'>Desktop</Pill.Text>
					</Pill>
					<Typography.H2 className='border-none pb-0 font-normal text-3xl leading-[1.15] tracking-tight md:text-5xl' data-motion='heading'>
						Your focus, on your desktop.
					</Typography.H2>
					<Typography.Lead className='max-w-md text-base text-foreground/70 leading-relaxed' data-motion='text'>
						A native app for macOS and Windows. Same account as the web, always in sync.
					</Typography.Lead>
					{/* Stacked in a shrink-to-fit grid column, so both buttons take the width of the longer one. */}
					<Layout.Grid className='mt-4 w-fit' cols={1} gap='md'>
						<a className={cn(buttonVariants.root({ variant: 'primary' }), 'w-full justify-center rounded-full px-6 py-3')} data-motion='item' href={MACOS_DOWNLOAD_URL}>
							<AppleLight aria-hidden='true' className='size-4' />
							<Typography.Small className='text-background'>Download for macOS</Typography.Small>
						</a>
						<a className={cn(buttonVariants.root({ variant: 'secondary' }), glass.pill, 'justify-center px-6 py-3')} data-motion='item' href={WINDOWS_DOWNLOAD_URL}>
							{/* The svgl logo is Windows blue; painted with the text color so it matches the white Apple logo. */}
							<Windows aria-hidden='true' className='size-4 [&_path]:fill-foreground' />
							<Typography.Small>Download for Windows</Typography.Small>
						</a>
					</Layout.Grid>
				</Layout.Stack>
				<div className='min-w-0 lg:flex-1' data-motion='surface'>
					<Laptop />
				</div>
			</Layout.Container>
			{/* Softens the cut at the bottom of the laptop into the footer. */}
			<div aria-hidden className='pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-background' />
		</section>
	);
}
