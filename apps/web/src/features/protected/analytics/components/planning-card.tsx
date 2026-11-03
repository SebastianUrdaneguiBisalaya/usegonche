import { Target } from 'lucide-react';
import { Chart } from '~/components/ui/data-display/charts/charts';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { usePlanning, useSummary } from '../api';
import { dayLabel } from '../format';
import { formatRate, pointsChange, type RangePreset } from '../range';
import { Delta } from './delta';
import { Headline, MetricCard, QueryBody } from './metric-card';
import { LINE_COLOR } from './tones';

/** Share of each daily plan that ended up done: how often the plan was met. */
export function PlanningCard({ base }: { base: RangePreset }) {
	const t = useTranslate();
	return (
		<MetricCard base={base} icon={Target} subtitle={t('analytics.planning.subtitle')} title={t('analytics.planning.title')}>
			{range => <PlanningBody range={range} />}
		</MetricCard>
	);
}

function PlanningBody({ range }: { range: { from: string; to: string } }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const query = usePlanning(range);
	const summary = useSummary(range);
	const change = summary.data ? pointsChange(summary.data.current.planCompletion.rate, summary.data.previous.planCompletion.rate) : null;

	return (
		<QueryBody query={query}>
			{({ overall, series }) => (
				<>
					<Headline delta={<Delta value={change} />}>{formatRate(overall.rate)}</Headline>
					<Chart.Area
						areas={[{ color: LINE_COLOR, dataKey: 'rate', name: t('analytics.planning.series'), strokeWidth: 1.5 }]}
						connectNulls
						data={series.map(point => ({ label: dayLabel(point.date, locale), rate: point.rate === null ? null : Math.round(point.rate * 100) }))}
						grid={false}
						height={200}
						valueFormatter={value => `${value}%`}
						xAxisKey='label'
					/>
				</>
			)}
		</QueryBody>
	);
}
