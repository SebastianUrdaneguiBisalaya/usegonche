'use client';

import { ArrowLeft, Compass } from 'lucide-react';
import { buttonVariants } from '@/components/ui/actions-controls/button/button';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { SIGN_IN_URL } from '@/lib/links';
import { glass } from '@/styles/glass';

/** Full-screen "not found" page: the mountain artwork of the landing with a single message and two ways back. */
export default function NotFound() {
	return (
		<section className="relative flex min-h-svh w-full items-center overflow-hidden bg-[url('/bg-mountain.png')] bg-cover bg-center">
			{/* Darkens the artwork behind the text and fades it into the page background at the bottom. */}
			<div aria-hidden className='pointer-events-none absolute inset-0 bg-linear-to-b from-background/70 via-background/50 to-background' />
			<Layout.Container className='relative flex min-h-svh flex-col items-center justify-center gap-10 py-24 text-center' size={LANDING_WIDTH}>
				<span className={cn(glass.surface, 'flex size-14 items-center justify-center rounded-full')}>
					<Icon aria-hidden='true' icon={Compass} size='xl' />
				</span>
				<Layout.Stack align='center' gap='lg'>
					<Typography.H1 className='border-none pb-0 font-normal text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl'>
						<span className='block'>This page is</span>
						<span className='block text-foreground/60'>off the map.</span>
					</Typography.H1>
					<Typography.Lead className='max-w-md text-base text-foreground/70 leading-relaxed'>
						The link may be broken or the page may have moved. Head back to the start and keep going.
					</Typography.Lead>
				</Layout.Stack>
				<Layout.HStack className='flex-wrap justify-center' gap='md'>
					<a className={cn(buttonVariants.root({ variant: 'primary' }), 'rounded-full px-6 py-3')} href='/'>
						<Icon aria-hidden='true' className='text-background' icon={ArrowLeft} size='sm' />
						<Typography.Small className='text-background'>Back to home</Typography.Small>
					</a>
					<a className={cn(buttonVariants.root({ variant: 'secondary' }), glass.pill, 'px-6 py-3')} href={SIGN_IN_URL}>
						<Typography.Small>Sign in</Typography.Small>
					</a>
				</Layout.HStack>
			</Layout.Container>
		</section>
	);
}
