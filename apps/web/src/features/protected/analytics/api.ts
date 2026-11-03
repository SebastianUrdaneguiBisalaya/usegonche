import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { type Data, unwrap } from '~/lib/api-error';

export interface DateRange {
	from: string;
	to: string;
}

type SummaryResponse = Awaited<ReturnType<typeof api.metrics.summary.$get>>;
type ThroughputResponse = Awaited<ReturnType<typeof api.metrics.throughput.$get>>;
type FocusResponse = Awaited<ReturnType<(typeof api.metrics)['focus-time']['$get']>>;
type PlanningResponse = Awaited<ReturnType<typeof api.metrics.planning.$get>>;
type BlockersResponse = Awaited<ReturnType<typeof api.metrics.blockers.$get>>;
type RhythmResponse = Awaited<ReturnType<typeof api.metrics.rhythm.$get>>;

export type MetricsSummary = Data<SummaryResponse>;
export type Throughput = Data<ThroughputResponse>;
export type FocusTime = Data<FocusResponse>;
export type PlanningReliability = Data<PlanningResponse>;
export type BlockerMetrics = Data<BlockersResponse>;
export type Rhythm = Data<RhythmResponse>;

/** `GET /metrics/summary`: this period's figures next to the previous period of the same length, plus the live snapshot. */
export function useSummary({ from, to }: DateRange) {
	return useQuery({ queryFn: () => unwrap(api.metrics.summary.$get({ query: { from, to } })), queryKey: ['metrics', 'summary', from, to] });
}

/** `GET /metrics/throughput`: tasks created and completed per day. */
export function useThroughput({ from, to }: DateRange) {
	return useQuery({ queryFn: () => unwrap(api.metrics.throughput.$get({ query: { from, granularity: 'day', to } })), queryKey: ['metrics', 'throughput', from, to] });
}

/** `GET /metrics/focus-time`: planned vs. really worked minutes per day. */
export function useFocusTime({ from, to }: DateRange) {
	return useQuery({ queryFn: () => unwrap(api.metrics['focus-time'].$get({ query: { from, to } })), queryKey: ['metrics', 'focus', from, to] });
}

/** `GET /metrics/planning`: for each daily plan, how many of its tasks are done. */
export function usePlanning({ from, to }: DateRange) {
	return useQuery({ queryFn: () => unwrap(api.metrics.planning.$get({ query: { from, to } })), queryKey: ['metrics', 'planning', from, to] });
}

/** `GET /metrics/blockers`: blockers started in the period, grouped by reason. */
export function useBlockers({ from, to }: DateRange) {
	return useQuery({ queryFn: () => unwrap(api.metrics.blockers.$get({ query: { from, to } })), queryKey: ['metrics', 'blockers', from, to] });
}

/** `GET /metrics/rhythm`: when the user completes tasks, by weekday and hour. */
export function useRhythm({ from, to }: DateRange) {
	return useQuery({ queryFn: () => unwrap(api.metrics.rhythm.$get({ query: { from, to } })), queryKey: ['metrics', 'rhythm', from, to] });
}
