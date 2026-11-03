import { TriangleAlert } from 'lucide-react';
import { Chart } from '~/components/ui/data-display/charts/charts';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useTranslate } from '~/hooks/use-translate';
import { useBlockers } from '../api';
import type { RangePreset } from '../range';
import { Headline, MetricCard, QueryBody } from './metric-card';
import { BAR_COLOR } from './tones';

const MAX_REASONS = 6;

/** Blockers started in the period, grouped by the reason written for them (most frequent first). */
export function BlockersCard({ base }: { base: RangePreset }) {
	const t = useTranslate();
	return (
		<MetricCard base={base} icon={TriangleAlert} iconClassName='text-destructive' subtitle={t('analytics.blockers.subtitle')} title={t('analytics.blockers.title')}>
			{range => <BlockersBody range={range} />}
		</MetricCard>
	);
}

function BlockersBody({ range }: { range: { from: string; to: string } }) {
	const t = useTranslate();
	const query = useBlockers(range);

	return (
		<QueryBody query={query}>
			{({ open, reasons, resolved, total }) => (
				<>
					<Headline delta={<Typography.Span className='text-sm text-muted-foreground'>{t('analytics.blockers.split', { open, resolved })}</Typography.Span>}>{total}</Headline>
					{reasons.length === 0 ? (
						<Typography.Span className='flex h-[200px] items-center justify-center text-sm text-muted-foreground'>{t('analytics.blockers.empty')}</Typography.Span>
					) : (
						<Chart.Bar
							bars={[{ color: BAR_COLOR, dataKey: 'occurrences', name: t('analytics.blockers.series'), radius: [0, 2, 2, 0] }]}
							data={reasons.slice(0, MAX_REASONS).map(reason => ({ occurrences: reason.occurrences, reason: reason.reason }))}
							grid={false}
							height={200}
							layout='vertical'
							xAxisKey='reason'
						/>
					)}
				</>
			)}
		</QueryBody>
	);
}
