import { ArrowRight, CircleAlert, CircleCheck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useTranslate } from '~/hooks/use-translate';
import { apiDateOnly } from '../../shared/dates';
import { listStyles } from '../../shared/styles';
import type { Review } from '../api';

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<li className='flex items-center justify-between gap-3 text-sm'>
			<span className='flex items-center gap-3'>
				{icon}
				{label}
			</span>
			<span className='tabular-nums text-muted-foreground'>{value}</span>
		</li>
	);
}

/** On track / overdue counts and the blocker reasons that keep coming back (shown while the review is open). */
export function SummaryCard({ review }: { review: Review }) {
	const t = useTranslate();
	const { prefill } = review;
	if (!prefill) return null;

	const { plannedTasks, completedTasks } = prefill.counters;
	const periodEnd = apiDateOnly(review.periodEnd);
	const overdue = prefill.pending.filter(task => task.dueDate && apiDateOnly(task.dueDate) < periodEnd).length;
	const blockers = prefill.recurringBlockers;

	return (
		<section className={`${listStyles.card} flex flex-col gap-4 p-5`}>
			<Typography.H3 className='text-base font-semibold'>{t('reflect.summary.title')}</Typography.H3>
			<ul className='flex flex-col gap-3'>
				<Row icon={<CircleCheck aria-hidden className='size-5 text-success' />} label={t('reflect.summary.onTrack')} value={`${Math.min(completedTasks, plannedTasks)} / ${plannedTasks}`} />
				<Row icon={<CircleAlert aria-hidden className='size-5 text-warning' />} label={t('reflect.summary.overdue')} value={String(overdue)} />
			</ul>
			<div className='flex flex-col gap-2 border-t border-border pt-4'>
				<div className='flex items-center justify-between gap-3'>
					<span className='flex items-center gap-3 text-sm font-medium'>
						<RefreshCw aria-hidden className='size-5 text-muted-foreground' />
						{t('reflect.summary.recurring')}
					</span>
					<span className='flex size-6 items-center justify-center rounded-full bg-foreground/[0.08] text-xs tabular-nums'>{blockers.length}</span>
				</div>
				{blockers.length === 0 ? (
					<Typography.Span className='text-xs text-muted-foreground'>{t('reflect.summary.noBlockers')}</Typography.Span>
				) : (
					<>
						<ul className='flex flex-col gap-1'>
							{blockers.map(blocker => (
								<li className='flex items-center justify-between gap-2 text-xs text-muted-foreground' key={blocker.reason}>
									<span className='truncate' title={blocker.reason}>
										{blocker.reason}
									</span>
									<span className='tabular-nums'>×{blocker.occurrences}</span>
								</li>
							))}
						</ul>
						<Link className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground' to='/tasks?blocked=true'>
							{t('reflect.summary.details')}
							<ArrowRight aria-hidden className='size-3' />
						</Link>
					</>
				)}
			</div>
		</section>
	);
}
