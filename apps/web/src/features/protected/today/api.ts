import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { unwrapPage } from '../shared/paged';

type DayResponse = Awaited<ReturnType<(typeof api.planning.days)[':date']['$get']>>;

/** One local day as the API sees it: the planned tasks (ordered), plus events, blocks and capacity. */
export type DayView = Extract<Awaited<ReturnType<DayResponse['json']>>, { data: unknown }>['data'];
export type DayItem = DayView['items'][number];

export const dayKey = (date: string) => ['planning', 'day', date] as const;

/** `GET /planning/days/:date`. */
export function useDay(date: string) {
	return useQuery({ queryFn: () => unwrap(api.planning.days[':date'].$get({ param: { date } })), queryKey: dayKey(date) });
}

/** `PUT /planning/days/:date/items`: replaces the whole ordered list of the day's tasks. */
export function useSetDayItems(date: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (taskIds: string[]) => unwrap(api.planning.days[':date'].items.$put({ json: { taskIds }, param: { date } })),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ['planning'] }),
	});
}

/** Open tasks that are blocked (`GET /tasks?blocked=true`): the card shows the first few and the total. */
export function useBlockedTasks() {
	return useQuery({
		queryFn: () => unwrapPage(api.tasks.$get({ query: { blocked: 'true', order: 'desc', page: '1', pageSize: '3', sort: 'updatedAt', status: ['todo', 'in_progress'] } })),
		queryKey: ['tasks', 'blocked', 'today'],
	});
}

/** Open tasks to pick from when planning a day (title filtering happens in the picker). */
export function useOpenTasks() {
	return useQuery({
		queryFn: () => unwrap(api.tasks.$get({ query: { order: 'desc', page: '1', pageSize: '100', sort: 'updatedAt', status: ['todo', 'in_progress'] } })),
		queryKey: ['tasks', 'open', 'pick'],
		staleTime: 30_000,
	});
}
