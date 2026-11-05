import { Progress } from '~/components/ui/data-display/progress/progress';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import type { DayView } from '../api';
import { formatMinutes } from '../format';

/**
 * Planned vs available time of the day: plain sums of estimates and working hours minus events, never a score.
 * Without `capacity` (the day is still loading) it keeps its place with a skeleton of the same height, so the cards below do not jump.
 */
export function CapacityCard({ capacity }: { capacity?: DayView['capacity'] }) {
	const t = useTranslate();
	if (!capacity) {
		return (
			<section aria-busy className={cn(listStyles.card, 'flex flex-col gap-3 p-5')}>
				<div className='flex items-center justify-between gap-3'>
					<Typography.H3 className='text-base font-semibold'>{t('today.capacity.title')}</Typography.H3>
					<Skeleton className='h-5 w-32' />
				</div>
				<Skeleton className='h-1.5 w-full' />
				<Skeleton className='h-4 w-40' />
			</section>
		);
	}
	const { availableMinutes, overcommitted, plannedMinutes, remainingMinutes, unestimatedTasks, workingMinutes } = capacity;

	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-3 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<Typography.H3 className='text-base font-semibold'>{t('today.capacity.title')}</Typography.H3>
				<Typography.Span className='text-sm text-muted-foreground tabular-nums'>
					{t('today.capacity.summary', { available: formatMinutes(availableMinutes), planned: formatMinutes(plannedMinutes) })}
				</Typography.Span>
			</div>
			<Progress
				aria-label={t('today.capacity.title')}
				className={cn('h-1.5', overcommitted ? 'text-destructive' : '')}
				max={Math.max(availableMinutes, plannedMinutes, 1)}
				value={plannedMinutes}
			>
				<Progress.Indicator />
			</Progress>
			{workingMinutes === 0 ? (
				<Typography.Span className='text-xs text-muted-foreground'>{t('today.capacity.noHours')}</Typography.Span>
			) : (
				<Typography.Span className={cn('text-xs', overcommitted ? 'text-destructive' : 'text-muted-foreground')}>
					{overcommitted ? t('today.capacity.over', { time: formatMinutes(-remainingMinutes) }) : t('today.capacity.remaining', { time: formatMinutes(remainingMinutes) })}
				</Typography.Span>
			)}
			{unestimatedTasks > 0 && (
				<Typography.Span className='text-xs text-muted-foreground'>
					{t(unestimatedTasks === 1 ? 'today.capacity.unestimated_one' : 'today.capacity.unestimated_other', { count: unestimatedTasks })}
				</Typography.Span>
			)}
		</section>
	);
}
