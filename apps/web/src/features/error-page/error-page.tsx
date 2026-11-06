import { ArrowLeft, Compass, TriangleAlert } from 'lucide-react';
import { buttonVariants } from '~/components/ui/actions-controls/button/button';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';

/** Same "glass" classes as `apps/www/src/styles/glass.ts`. */
const glass = {
	surface: 'border border-white/10 bg-transparent bg-linear-to-b from-white/[0.07] to-white/2 shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl',
	pill: 'rounded-full border border-white/20 bg-transparent hover:bg-white/5',
} as const;

export interface ErrorPageProps {
	/** `notFound` for a 404, `error` for anything else. */
	kind: 'notFound' | 'error';
	/** Stack trace, shown only in development. */
	stack?: string;
}

/** Full-screen error page (copied from the `apps/www` not-found): the mountain artwork with a single message and two ways back. */
export function ErrorPage({ kind, stack }: ErrorPageProps) {
	const t = useTranslate();
	return (
		<section className="relative flex min-h-svh w-full items-center overflow-y-auto bg-[url('/bg-mountain.png')] bg-cover bg-center">
			{/* Darkens the artwork behind the text and fades it into the page background at the bottom. */}
			<div aria-hidden className='pointer-events-none absolute inset-0 bg-linear-to-b from-background/70 via-background/50 to-background' />
			<Layout.Container className='relative flex min-h-svh flex-col items-center justify-center gap-10 py-24 text-center' size='xl'>
				<span className={cn(glass.surface, 'flex size-14 items-center justify-center rounded-full')}>
					<Icon aria-hidden='true' icon={kind === 'notFound' ? Compass : TriangleAlert} size='xl' />
				</span>
				<Layout.Stack align='center' gap='lg'>
					<Typography.H1 className='border-none pb-0 font-normal text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl'>
						<span className='block'>{t(`errorPage.${kind}.titleLine1`)}</span>
						<span className='block text-foreground/60'>{t(`errorPage.${kind}.titleLine2`)}</span>
					</Typography.H1>
					<Typography.Lead className='max-w-md text-base text-foreground/70 leading-relaxed'>{t(`errorPage.${kind}.description`)}</Typography.Lead>
				</Layout.Stack>
				{/* Equal-width columns: both buttons take the width of the wider one. */}
				<div className='grid auto-cols-fr grid-flow-col gap-4'>
					<a className={cn(buttonVariants.root({ variant: 'primary' }), 'w-full rounded-full px-6 py-3')} href='/'>
						<Icon aria-hidden='true' className='text-background' icon={ArrowLeft} size='sm' />
						<Typography.Small className='text-background'>{t('errorPage.backHome')}</Typography.Small>
					</a>
					<a className={cn(buttonVariants.root({ variant: 'secondary' }), glass.pill, 'w-full px-6 py-3')} href='/auth/sign-in'>
						<Typography.Small>{t('errorPage.signIn')}</Typography.Small>
					</a>
				</div>
				{stack && (
					<pre className={cn(glass.surface, 'max-h-64 w-full max-w-3xl overflow-auto rounded-xl p-4 text-left text-xs')}>
						<code>{stack}</code>
					</pre>
				)}
			</Layout.Container>
		</section>
	);
}
