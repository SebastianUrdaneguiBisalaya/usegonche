import { Clock } from 'lucide-react';
import { Chart } from '~/components/ui/data-display/charts/charts';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatMinutes } from '../../today/format';
import { useFocusTime, useSummary } from '../api';
import { dayLabel, toHours } from '../format';
import { percentChange, type RangePreset } from '../range';
import { Delta } from './delta';
import { Headline, MetricCard, QueryBody } from './metric-card';
import { LINE_COLOR } from './tones';

/** Hours really worked in done time blocks, per day. */
export function FocusCard({ base }: { base: RangePreset }) {
	const t = useTranslate();
	return (
		<MetricCard base={base} icon={Clock} subtitle={t('analytics.focus.subtitle')} title={t('analytics.focus.title')}>
			{range => <FocusBody range={range} />}
		</MetricCard>
	);
}

function FocusBody({ range }: { range: { from: string; to: string } }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const query = useFocusTime(range);
	const summary = useSummary(range);
	const change = summary.data ? percentChange(summary.data.current.focusMinutes, summary.data.previous.focusMinutes) : null;

	return (
		<QueryBody query={query}>
			{({ series, totals }) => (
				<>
					<Headline delta={<Delta value={change} />}>{formatMinutes(totals.actualMinutes)}</Headline>
					<Chart.Area
						areas={[{ color: LINE_COLOR, dataKey: 'hours', name: t('analytics.focus.series'), strokeWidth: 1.5 }]}
						data={series.map(point => ({ hours: toHours(point.actualMinutes), label: dayLabel(point.date, locale) }))}
						grid={false}
						height={200}
						valueFormatter={value => `${value}h`}
						xAxisKey='label'
					/>
				</>
			)}
		</QueryBody>
	);
}
