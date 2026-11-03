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

export type DayBlock = DayView['blocks'][number];

/** A planned block changes what Today, the history and the metrics show, so they all refetch. */
function useRefreshBlocks() {
	const queryClient = useQueryClient();
	return () => Promise.all([queryClient.invalidateQueries({ queryKey: ['planning'] }), queryClient.invalidateQueries({ queryKey: ['tasks'] })]);
}

/** `POST /planning/blocks`: a block for a task, a title, or both. */
export function useCreateBlock() {
	const refresh = useRefreshBlocks();
	return useMutation({
		mutationFn: (json: { plannedEnd: string; plannedStart: string; taskId?: string; title?: string }) => unwrap(api.planning.blocks.$post({ json })),
		onSuccess: refresh,
	});
}

/** `POST /planning/blocks/:id/move`: never edits the block, it plans a new one and keeps the old one as history. */
export function useMoveBlock() {
	const refresh = useRefreshBlocks();
	return useMutation({
		mutationFn: ({ id, plannedEnd, plannedStart }: { id: string; plannedEnd: string; plannedStart: string }) =>
			unwrap(api.planning.blocks[':id'].move.$post({ json: { plannedEnd, plannedStart }, param: { id } })),
		onSuccess: refresh,
	});
}

/** `PATCH /planning/blocks/:id`: closes a planned block as done or missed. */
export function useCloseBlock() {
	const refresh = useRefreshBlocks();
	return useMutation({
		mutationFn: ({ id, status }: { id: string; status: 'done' | 'missed' }) => unwrap(api.planning.blocks[':id'].$patch({ json: { status }, param: { id } })),
		onSuccess: refresh,
	});
}

/** `DELETE /planning/blocks/:id` (only a planned, never moved block). */
export function useDeleteBlock() {
	const refresh = useRefreshBlocks();
	return useMutation({ mutationFn: (id: string) => unwrap(api.planning.blocks[':id'].$delete({ param: { id } })), onSuccess: refresh });
}

type ReplanResponse = Awaited<ReturnType<(typeof api.planning)['replan-proposals']['$get']>>;
export type ReplanProposal = Extract<Awaited<ReturnType<ReplanResponse['json']>>, { data: unknown }>['data'][number];

/** `GET /planning/replan-proposals`: for each missed or interrupted block of the day, the first free slot that fits what is left. Proposals only, nothing is applied. */
export function useReplanProposals(date: string) {
	return useQuery({
		queryFn: () => unwrap(api.planning['replan-proposals'].$get({ query: { date, days: '7' } })),
		queryKey: ['planning', 'replan', date],
	});
}
