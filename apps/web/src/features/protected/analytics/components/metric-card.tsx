import type { UseQueryResult } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';

interface MetricCardProps {
	children: ReactNode;
	icon: LucideIcon;
	iconClassName?: string;
	subtitle: string;
	title: string;
}

/** Frame of a chart card: icon, title and subtitle, and whatever the card draws for the page's date range. */
export function MetricCard({ children, icon: Icon, iconClassName = '', subtitle, title }: MetricCardProps) {
	return (
		<section className={cn(listStyles.card, 'flex min-w-0 flex-col gap-4 p-5')}>
			<header className='flex items-start gap-3'>
				<div className='flex min-w-0 items-start gap-3'>
					<Icon aria-hidden className={cn('mt-0.5 size-6 shrink-0 text-muted-foreground', iconClassName)} />
					<div className='flex min-w-0 flex-col'>
						<Typography.H3 className='text-lg font-medium leading-tight'>{title}</Typography.H3>
						<Typography.Span className='text-sm text-muted-foreground'>{subtitle}</Typography.Span>
					</div>
				</div>
			</header>
			{children}
		</section>
	);
}

interface QueryBodyProps<T> {
	children: (data: T) => ReactNode;
	height?: number;
	query: UseQueryResult<T>;
}

/** Loading skeleton, a retry on error, or the card's content. */
export function QueryBody<T>({ children, height = 236, query }: QueryBodyProps<T>) {
	const t = useTranslate();
	if (query.isError)
		return (
			<div className='flex flex-col items-start gap-2' style={{ minHeight: height }}>
				<Typography.Span className='text-sm text-muted-foreground'>{t('analytics.error')}</Typography.Span>
				<Button onClick={() => void query.refetch()} variant='secondary'>
					<Button.Text>{t('analytics.retry')}</Button.Text>
				</Button>
			</div>
		);
	if (!query.data)
		return (
			<Skeleton>
				<Skeleton.Item className='w-full rounded-xl' style={{ height }} />
			</Skeleton>
		);
	return <>{children(query.data)}</>;
}

/** The big number of a card with its change next to it ("42  ↑ +8%"). */
export function Headline({ children, delta }: { children: ReactNode; delta?: ReactNode }) {
	return (
		<div className='flex items-baseline gap-3'>
			<span className='text-4xl font-medium leading-none tabular-nums'>{children}</span>
			{delta}
		</div>
	);
}
