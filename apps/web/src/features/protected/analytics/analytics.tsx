import { Fragment } from 'react';
import { CalendarDays } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
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
			{/* Changing the page's range remounts the cards, so a card's own range goes back to it. */}
			<Page.Body className='min-h-0 flex-1 gap-4' key={param}>
				<SummaryStrip range={range} />
				<Layout.Grid cols={{ base: 1, xl: 2 }} gap='md'>
					<ThroughputCard base={param} />
					<FocusCard base={param} />
					<PlanningCard base={param} />
					<BlockersCard base={param} />
					<RhythmCard base={param} />
					<InsightsCard range={range} />
				</Layout.Grid>
			</Page.Body>
		</Fragment>
	);
}
