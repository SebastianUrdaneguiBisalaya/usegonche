import { TrendingUp } from 'lucide-react';
import { Chart } from '~/components/ui/data-display/charts/charts';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { type DateRange, useSummary, useThroughput } from '../api';
import { dayLabel } from '../format';
import { percentChange } from '../range';
import { Delta } from './delta';
import { Headline, MetricCard, QueryBody } from './metric-card';
import { BAR_COLOR } from './tones';

/** Tasks completed per day over the period, with the total and its change against the previous period. */
export function ThroughputCard({ range }: { range: DateRange }) {
	const t = useTranslate();
	return (
		<MetricCard icon={TrendingUp} subtitle={t('analytics.throughput.subtitle')} title={t('analytics.throughput.title')}>
			<ThroughputBody range={range} />
		</MetricCard>
	);
}

function ThroughputBody({ range }: { range: DateRange }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const query = useThroughput(range);
	const summary = useSummary(range);
	const change = summary.data ? percentChange(summary.data.current.tasksCompleted, summary.data.previous.tasksCompleted) : null;

	return (
		<QueryBody query={query}>
			{({ series, totals }) => (
				<>
					<Headline delta={<Delta value={change} />}>{totals.completed}</Headline>
					<Chart.Bar
						bars={[{ color: BAR_COLOR, dataKey: 'completed', name: t('analytics.throughput.series'), radius: [2, 2, 0, 0] }]}
						data={series.map(point => ({ completed: point.completed, label: dayLabel(point.date, locale) }))}
						grid={false}
						height={200}
						xAxisKey='label'
					/>
				</>
			)}
		</QueryBody>
	);
}
