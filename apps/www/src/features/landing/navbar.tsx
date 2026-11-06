'use client';

import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/actions-controls/button/button';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Logo } from '@/components/ui/foundations/logo/logo';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Layout } from '@/components/ui/layout/layout/layout';
import { Image } from '@/components/ui/media-files/image/image';
import { Navbar } from '@/components/ui/navigation/navbar/navbar';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { LANDING_WIDTH } from '@/lib/layout';
import { SIGN_IN_URL, SIGN_UP_URL } from '@/lib/links';
import { glass } from '@/styles/glass';

const sections = [
	{ href: '#features', label: 'Features' },
	{ href: '#how-it-works', label: 'How it works' },
	{ href: '#desktop', label: 'Desktop' },
	{ href: '#faq', label: 'FAQ' },
] as const;

const linkClass = 'text-foreground/85 hover:text-foreground';

function GetStartedLink({ className }: { className?: string }) {
	return (
		<a className={cn(buttonVariants.root({ variant: 'secondary' }), glass.pill, 'px-5 py-2.5', className)} href={SIGN_UP_URL}>
			<Typography.Small>Get started free</Typography.Small>
			<Icon aria-hidden='true' icon={ArrowRight} size='sm' />
		</a>
	);
}

/** Floating glass navbar of the landing: as wide as the sections' content (`LANDING_WIDTH`) at the top, it narrows once the page scrolls and grows back on returning to the top. */
export default function LandingNavbar() {
	return (
		<Layout.Container className='pointer-events-none fixed inset-x-0 top-4 z-40' size={LANDING_WIDTH}>
			<Navbar.Root
				className={cn('pointer-events-auto w-full max-w-full rounded-[28px] data-[scrolled=true]:max-w-4xl [html[data-navbar-scrolled=true]_&]:max-w-4xl', glass.surface)}
				sticky={false}
				tone='default'
				variant='floating'
			>
				<Navbar.Bar className='px-5 md:grid md:grid-cols-[1fr_auto_1fr]'>
					<Navbar.Brand aria-label='gonche, home' className='justify-self-start' href='/'>
						<Logo size='lg'>
							<Image className='-my-6 size-14 overflow-visible'>
								<Image.Img alt='' className='mix-blend-screen' src='/usegonche-icon.png' />
							</Image>
							<Logo.Text className='-ml-4 font-medium'>gonche</Logo.Text>
						</Logo>
					</Navbar.Brand>
					<Navbar.Nav className='gap-8'>
						{sections.map(section => (
							<Navbar.Link className={linkClass} href={section.href} key={section.href}>
								{section.label}
							</Navbar.Link>
						))}
					</Navbar.Nav>
					<Navbar.Actions className='justify-self-end gap-6'>
						<Navbar.Link className={linkClass} href={SIGN_IN_URL}>
							Sign in
						</Navbar.Link>
						<GetStartedLink />
					</Navbar.Actions>
					<Navbar.Trigger />
				</Navbar.Bar>
				<Navbar.MobilePanel className='border-white/10 px-5'>
					{sections.map(section => (
						<Navbar.Link className={cn(linkClass, 'py-2')} href={section.href} key={section.href}>
							{section.label}
						</Navbar.Link>
					))}
					<Navbar.Link className={cn(linkClass, 'py-2')} href={SIGN_IN_URL}>
						Sign in
					</Navbar.Link>
					<GetStartedLink className='mt-2 w-full' />
				</Navbar.MobilePanel>
			</Navbar.Root>
		</Layout.Container>
	);
}
