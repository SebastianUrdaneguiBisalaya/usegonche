import { CalendarCheck, CircleCheck, Clock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { formatMinutes } from '../../today/format';
import { type DateRange, useSummary } from '../api';
import { formatRate, percentChange, pointsChange } from '../range';
import { Delta } from './delta';

function Tile({ delta, icon: Icon, label, value }: { delta: ReactNode; icon: LucideIcon; label: string; value: string }) {
	return (
		<div className='grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-0.5 px-6 py-5'>
			<Icon aria-hidden className='size-9 shrink-0 text-muted-foreground' strokeWidth={1.5} />
			<div className='flex flex-col gap-0.5'>
				<span className='text-3xl font-medium leading-none tabular-nums'>{value}</span>
				<Typography.Span className='text-sm text-muted-foreground'>{label}</Typography.Span>
			</div>
			<span className='col-start-2 min-h-5'>{delta}</span>
		</div>
	);
}

/** Completed tasks, focus time and planning reliability of the period, each next to its change against the previous period. */
export function SummaryStrip({ range }: { range: DateRange }) {
	const t = useTranslate();
	const { data } = useSummary(range);
	const current = data?.current;
	const previous = data?.previous;

	return (
		<section className={cn(listStyles.card, 'overflow-hidden')}>
			<Layout.Grid className='divide-y divide-border md:divide-x md:divide-y-0' cols={{ base: 1, md: 3 }} gap='none'>
				<Tile
					delta={current && previous && <Delta value={percentChange(current.tasksCompleted, previous.tasksCompleted)} />}
					icon={CircleCheck}
					label={t('analytics.summary.completed')}
					value={current ? String(current.tasksCompleted) : '–'}
				/>
				<Tile
					delta={current && previous && <Delta value={percentChange(current.focusMinutes, previous.focusMinutes)} />}
					icon={Clock}
					label={t('analytics.summary.focus')}
					value={current ? formatMinutes(current.focusMinutes) : '–'}
				/>
				<Tile
					delta={current && previous && <Delta value={pointsChange(current.planCompletion.rate, previous.planCompletion.rate)} />}
					icon={CalendarCheck}
					label={t('analytics.summary.planning')}
					value={current ? formatRate(current.planCompletion.rate) : '–'}
				/>
			</Layout.Grid>
		</section>
	);
}
