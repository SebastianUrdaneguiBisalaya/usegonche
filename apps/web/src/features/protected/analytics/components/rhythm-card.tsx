import { Activity } from 'lucide-react';
import { ActivityCalendar } from '~/components/ui/data-display/activity-calendar/activity-calendar';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { useDateTime } from '../../shared/use-datetime';
import { type DateRange, useRhythm, useThroughput } from '../api';
import { hourName, weekdayName } from '../format';
import { MetricCard, QueryBody } from './metric-card';
import { LINE_COLOR } from './tones';

/** Days the grid reaches back, so it fills the card whatever the page's range: only the days of that range carry data, the rest stay empty. */
const GRID_DAYS = 365;

/** Tasks completed on each day of the period as a grid of squares (the period's days coloured, the rest empty), and the weekday and hour with the most completions. */
export function RhythmCard({ range }: { range: DateRange }) {
	const t = useTranslate();
	return (
		<MetricCard icon={Activity} subtitle={t('analytics.rhythm.subtitle')} title={t('analytics.rhythm.title')}>
			<RhythmBody range={range} />
		</MetricCard>
	);
}

function RhythmBody({ range }: { range: DateRange }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const { today } = useDateTime();
	const days = useThroughput(range);
	const rhythm = useRhythm(range);
	const peak = rhythm.data?.peak;

	return (
		<QueryBody height={140} query={days}>
			{({ series }) => (
				<div className='flex flex-col gap-3'>
					<ActivityCalendar
						cellSize={14}
						className='gap-2'
						color={LINE_COLOR}
						data={series.map(point => ({ count: point.completed, date: point.date }))}
						endDate={range.to}
						locale={locale}
						startDate={today(1 - GRID_DAYS)}
						unit={t('analytics.rhythm.unit')}
						unitPlural={t('analytics.rhythm.unitPlural')}
						weekStartsOn={0}
					>
						<ActivityCalendar.Grid className='[&>table]:mx-auto' />
						<ActivityCalendar.Legend lessLabel={t('analytics.rhythm.low')} moreLabel={t('analytics.rhythm.high')} />
					</ActivityCalendar>
					{peak && (
						<Typography.Span className='text-sm text-muted-foreground'>
							{t('analytics.rhythm.peak', { hour: hourName(peak.hour, locale), weekday: weekdayName(peak.weekday, locale) })}
						</Typography.Span>
					)}
				</div>
			)}
		</QueryBody>
	);
}
