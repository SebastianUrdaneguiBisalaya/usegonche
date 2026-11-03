import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { type Data, unwrap } from '~/lib/api-error';

type OpenResponse = Awaited<ReturnType<typeof api.reviews.$post>>;

/** A review with its decisions; `prefill` (the live figures of the period) is only present while it is open. */
export type Review = Data<OpenResponse>;
export type Prefill = NonNullable<Review['prefill']>;
export type ReviewKind = 'daily' | 'weekly';
export type DecisionAction = 'carry_over' | 'drop' | 'keep' | 'reschedule';
export type Decision = { action: DecisionAction; date?: string; taskId: string };

const periodKey = (kind: ReviewKind, date: string) => ['reviews', 'period', kind, date] as const;

/** `POST /reviews`: idempotent, so it opens the review of the period or returns the one that already exists (prefilled while open). */
export function useReview(kind: ReviewKind, date: string) {
	return useQuery({ queryFn: () => unwrap(api.reviews.$post({ json: { date, kind } })), queryKey: periodKey(kind, date), staleTime: 30_000 });
}

/** The cached key is the date the page asked for, which may be any day of the period; refetching is the safe way to sync. */
function useRefreshReviews() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: ['reviews'] });
}

/** `PATCH /reviews/:id` (only while open): `null` clears the text. */
export function useUpdateReview(id: string) {
	const refresh = useRefreshReviews();
	return useMutation({
		mutationFn: (json: { nextFocus?: string | null; reflection?: string | null }) => unwrap(api.reviews[':id'].$patch({ json, param: { id } })),
		onSuccess: () => void refresh(),
	});
}

/** `POST /reviews/:id/decisions`: applies and records the decisions in one transaction. */
export function useApplyDecisions(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (decisions: Decision[]) => unwrap(api.reviews[':id'].decisions.$post({ json: { decisions }, param: { id } })),
		onSuccess: () => Promise.all(['reviews', 'planning', 'tasks'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))),
	});
}

/** `POST /reviews/:id/close`: snapshots the figures and locks the review. */
export function useCloseReview(id: string) {
	const refresh = useRefreshReviews();
	return useMutation({
		mutationFn: (json: { nextFocus?: string | null; reflection?: string | null }) => unwrap(api.reviews[':id'].close.$post({ json, param: { id } })),
		onSuccess: () => void refresh(),
	});
}
