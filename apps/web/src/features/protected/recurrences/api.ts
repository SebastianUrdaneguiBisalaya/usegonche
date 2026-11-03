import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { type OkBody, unwrapPage } from '../shared/paged';

type ListResponse = Awaited<ReturnType<typeof api.recurrences.$get>>;
export type Recurrence = OkBody<ListResponse>['data'][number];
export type CreateRecurrenceBody = Body<typeof api.recurrences.$post>;
export type UpdateRecurrenceBody = Body<(typeof api.recurrences)[':id']['$patch']>;

export const recurrencesKey = ['recurrences'] as const;

/** `GET /recurrences` (the API caps a page at 100, plenty for a personal list). */
export function useRecurrences() {
	return useQuery({ placeholderData: keepPreviousData, queryFn: () => unwrapPage(api.recurrences.$get({ query: { page: '1', pageSize: '100' } })), queryKey: [...recurrencesKey, 'list'] });
}

/** One rule, e.g. to show the rule of an occurrence in the task drawer. */
export function useRecurrence(id: string | null | undefined) {
	return useQuery({ enabled: Boolean(id), queryFn: () => unwrap(api.recurrences[':id'].$get({ param: { id: id ?? '' } })), queryKey: [...recurrencesKey, 'one', id] });
}

/** The next open occurrences of a rule: the tasks it generated (`GET /tasks?recurrenceId=`), soonest first. */
export function useOccurrences(recurrenceId: string, limit = 3) {
	return useQuery({
		queryFn: () => unwrap(api.tasks.$get({ query: { order: 'asc', page: '1', pageSize: String(limit), recurrenceId, sort: 'dueDate', status: ['todo', 'in_progress'] } })),
		queryKey: ['tasks', 'occurrences', recurrenceId, limit],
	});
}

/** A rule changes the tasks it generates, so those refresh too. */
function useRefresh() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([queryClient.invalidateQueries({ queryKey: recurrencesKey }), queryClient.invalidateQueries({ queryKey: ['tasks'] }), queryClient.invalidateQueries({ queryKey: ['planning'] })]);
}

/** `POST /recurrences`: creates the rule and its first occurrences. */
export function useCreateRecurrence() {
	const refresh = useRefresh();
	return useMutation({ mutationFn: (json: CreateRecurrenceBody) => unwrap(api.recurrences.$post({ json })), onSuccess: refresh });
}

/** `PATCH /recurrences/:id`: applies to the future occurrences that are still untouched. */
export function useUpdateRecurrence() {
	const refresh = useRefresh();
	return useMutation({
		mutationFn: ({ changes, id }: { changes: UpdateRecurrenceBody; id: string }) => unwrap(api.recurrences[':id'].$patch({ json: changes, param: { id } })),
		onSuccess: refresh,
	});
}

/** `DELETE /recurrences/:id`: removes the rule and its untouched future occurrences. */
export function useDeleteRecurrence() {
	const refresh = useRefresh();
	return useMutation({ mutationFn: (id: string) => unwrap(api.recurrences[':id'].$delete({ param: { id } })), onSuccess: refresh });
}

const MATERIALIZED_KEY = 'usegonche:recurrences:materialized';

/**
 * Generates what is missing of every rule (`POST /recurrences/:id/materialize`, idempotent). Called when Today opens, at most once per day and browser:
 * the API only fills a 14-day window, so a day without opening the app is covered the next time.
 */
export function useMaterializeRecurrences(today: string) {
	const refresh = useRefresh();
	return useQuery({
		queryFn: async () => {
			try {
				if (window.localStorage.getItem(MATERIALIZED_KEY) === today) return 0;
			} catch {
				// Storage can be blocked: materializing again is harmless.
			}
			const { data } = await unwrapPage(api.recurrences.$get({ query: { page: '1', pageSize: '100' } }));
			await Promise.all(data.map(rule => unwrap(api.recurrences[':id'].materialize.$post({ param: { id: rule.id } }))));
			try {
				window.localStorage.setItem(MATERIALIZED_KEY, today);
			} catch {
				// Same: nothing to remember it with.
			}
			if (data.length > 0) await refresh();
			return data.length;
		},
		queryKey: [...recurrencesKey, 'materialize', today],
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
}
