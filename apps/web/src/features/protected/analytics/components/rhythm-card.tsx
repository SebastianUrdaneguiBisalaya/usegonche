import { Activity } from 'lucide-react';
import { ActivityCalendar } from '~/components/ui/data-display/activity-calendar/activity-calendar';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { useRhythm, useThroughput } from '../api';
import { hourName, weekdayName } from '../format';
import type { RangePreset } from '../range';
import { MetricCard, QueryBody } from './metric-card';
import { LINE_COLOR } from './tones';

/** Tasks completed on each day of the period as a grid of squares, and the weekday and hour with the most completions. */
export function RhythmCard({ base }: { base: RangePreset }) {
	const t = useTranslate();
	return (
		<MetricCard base={base} icon={Activity} subtitle={t('analytics.rhythm.subtitle')} title={t('analytics.rhythm.title')}>
			{range => <RhythmBody range={range} />}
		</MetricCard>
	);
}

function RhythmBody({ range }: { range: { from: string; to: string } }) {
	const t = useTranslate();
	const { locale } = useLanguage();
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
						startDate={range.from}
						unit={t('analytics.rhythm.unit')}
						unitPlural={t('analytics.rhythm.unitPlural')}
						weekStartsOn={0}
					>
						<ActivityCalendar.Grid />
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
