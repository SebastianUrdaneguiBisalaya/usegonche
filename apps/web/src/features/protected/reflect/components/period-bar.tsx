import { CalendarDays } from 'lucide-react';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import type { Review } from '../api';
import { completionRate, formatPeriod } from '../period';

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className='flex flex-col gap-0.5'>
			<span className='text-2xl font-medium tabular-nums'>{value}</span>
			<Typography.Span className='text-xs text-muted-foreground'>{label}</Typography.Span>
		</div>
	);
}

/** The figures of the period: live while the review is open, the snapshot taken on close afterwards. */
export function PeriodBar({ review }: { review: Review }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const planned = review.prefill?.counters.plannedTasks ?? review.plannedTasks ?? 0;
	const completed = review.prefill?.counters.completedTasks ?? review.completedTasks ?? 0;
	const rate = completionRate(planned, completed);

	return (
		<section className={cn(listStyles.card, 'flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4')}>
			<div className='flex items-center gap-3'>
				<span className='flex size-11 items-center justify-center rounded-xl border border-border bg-foreground/[0.04]'>
					<CalendarDays aria-hidden className='size-5 text-muted-foreground' />
				</span>
				<div className='flex flex-col'>
					<span className='text-sm font-medium'>{t('reflect.period.title')}</span>
					<Typography.Span className='text-xs text-muted-foreground'>{formatPeriod(locale, review.kind, review.periodStart, review.periodEnd)}</Typography.Span>
				</div>
			</div>
			<Stat label={t('reflect.period.planned')} value={planned} />
			<Stat label={t('reflect.period.completed')} value={completed} />
			{review.prefill && <Stat label={t('reflect.period.pending')} value={review.prefill.pending.length} />}
			<div className='flex items-center gap-3 sm:ml-auto'>
				<svg aria-hidden className='size-12 -rotate-90' viewBox='0 0 48 48'>
					<circle className='stroke-foreground/10' cx='24' cy='24' fill='none' r={RADIUS} strokeWidth='4' />
					<circle
						className='stroke-success'
						cx='24'
						cy='24'
						fill='none'
						r={RADIUS}
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={CIRCUMFERENCE * (1 - rate / 100)}
						strokeLinecap='round'
						strokeWidth='4'
					/>
				</svg>
				<div className='flex flex-col'>
					<span className='text-2xl font-medium tabular-nums'>{rate}%</span>
					<Typography.Span className='text-xs text-muted-foreground'>{t('reflect.period.rate')}</Typography.Span>
				</div>
			</div>
		</section>
	);
}
