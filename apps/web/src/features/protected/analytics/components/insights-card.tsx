import { CalendarCheck, Clock, Flame, Lightbulb, type LucideIcon, TrendingUp, TriangleAlert } from 'lucide-react';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { formatMinutes } from '../../today/format';
import { type DateRange, useSummary } from '../api';
import { formatRate, percentChange } from '../range';

/** A few plain-language readings of the summary: nothing is scored, every line states a figure the dashboard already shows. */
export function InsightsCard({ range }: { range: DateRange }) {
	const t = useTranslate();
	const { data } = useSummary(range);
	const lines: { icon: LucideIcon; text: string }[] = [];

	if (data) {
		const { current, previous, snapshot } = data;
		const tasks = percentChange(current.tasksCompleted, previous.tasksCompleted);
		lines.push({
			icon: TrendingUp,
			text:
				tasks === null || tasks === 0
					? t('analytics.insights.tasksSame', { count: current.tasksCompleted })
					: t(tasks > 0 ? 'analytics.insights.tasksUp' : 'analytics.insights.tasksDown', { percent: Math.abs(tasks) }),
		});
		const focus = percentChange(current.focusMinutes, previous.focusMinutes);
		lines.push({
			icon: Clock,
			text:
				focus === null || focus === 0
					? t('analytics.insights.focusSame', { time: formatMinutes(current.focusMinutes) })
					: t(focus > 0 ? 'analytics.insights.focusUp' : 'analytics.insights.focusDown', { percent: Math.abs(focus) }),
		});
		lines.push({ icon: CalendarCheck, text: t('analytics.insights.planning', { rate: formatRate(current.planCompletion.rate) }) });
		if (snapshot.overdue > 0) lines.push({ icon: TriangleAlert, text: t('analytics.insights.overdue', { count: snapshot.overdue }) });
		else if (snapshot.streak.current > 0) lines.push({ icon: Flame, text: t('analytics.insights.streak', { count: snapshot.streak.current }) });
	}

	return (
		<section className={cn(listStyles.card, 'flex min-w-0 flex-col gap-4 p-5')}>
			<Typography.H3 className='flex items-center gap-3 text-base font-medium'>
				<Lightbulb aria-hidden className='size-6 text-muted-foreground' />
				{t('analytics.insights.title')}
			</Typography.H3>
			<ul className='flex flex-col gap-3'>
				{lines.map(({ icon: Icon, text }) => (
					<li className='flex items-center gap-3 text-sm text-muted-foreground' key={text}>
						<Icon aria-hidden className='size-5 shrink-0 text-foreground/70' strokeWidth={1.5} />
						{text}
					</li>
				))}
			</ul>
		</section>
	);
}
