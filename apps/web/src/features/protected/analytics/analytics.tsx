import { CalendarDays } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Fragment } from 'react';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Page } from '~/components/ui/layout/page/page';
import { useTranslate } from '~/hooks/use-translate';
import { useDateTime } from '../shared/use-datetime';
import { BlockersCard } from './components/blockers-card';
import { FocusCard } from './components/focus-card';
import { InsightsCard } from './components/insights-card';
import { PlanningCard } from './components/planning-card';
import { RangeSelect } from './components/range-select';
import { RhythmCard } from './components/rhythm-card';
import { SummaryStrip } from './components/summary-strip';
import { ThroughputCard } from './components/throughput-card';
import { DEFAULT_PRESET, RANGE_PRESETS, rangeOf } from './range';

export default function AnalyticsRoute() {
	const t = useTranslate();
	const { today } = useDateTime();
	const [param, setParam] = useQueryState('range', parseAsStringLiteral(RANGE_PRESETS).withDefault(DEFAULT_PRESET));
	const range = rangeOf(param, today);

	return (
		<Fragment>
			<Page.Header>
				<div>
					<Page.Title>{t('analytics.title')}</Page.Title>
					<Page.Description>{t('analytics.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<RangeSelect label={t('analytics.range.page')} onChange={next => void setParam(next === DEFAULT_PRESET ? null : next)} value={param}>
						<CalendarDays aria-hidden className='size-4 text-muted-foreground' />
					</RangeSelect>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<SummaryStrip range={range} />
				<Layout.Grid cols={{ base: 1, xl: 2 }} gap='md'>
					<ThroughputCard range={range} />
					<FocusCard range={range} />
					<PlanningCard range={range} />
					<BlockersCard range={range} />
					<div className='xl:col-span-2'>
						<RhythmCard range={range} />
					</div>
					<div className='xl:col-span-2'>
						<InsightsCard range={range} />
					</div>
				</Layout.Grid>
			</Page.Body>
		</Fragment>
	);
}
