import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { type OkBody, PAGE_SIZE, unwrapPage } from '../shared/paged';
import type { GoalStatus, GoalsParams } from './search-params';

type GoalsResponse = Awaited<ReturnType<typeof api.goals.$get>>;

/** One page of `GET /goals`: the goals, the page meta and the counter of every status tab. */
export type GoalsPage = OkBody<GoalsResponse>;
export type Goal = GoalsPage['data'][number];

export type CreateGoalBody = Body<typeof api.goals.$post>;
export type UpdateGoalBody = Body<(typeof api.goals)[':id']['$patch']>;

type ListParams = Pick<GoalsParams, 'due' | 'page' | 'sort' | 'status'>;

const SORT_QUERY = {
	created: { order: 'desc', sort: 'createdAt' },
	targetDate: { order: 'asc', sort: 'targetDate' },
	title: { order: 'asc', sort: 'title' },
	updated: { order: 'desc', sort: 'updatedAt' },
} as const;

export const goalsKey = (params: ListParams) => ['goals', 'list', params] as const;

/** Query string of `GET /goals` (values are strings on the wire). The order is the one picked on the page. */
export const goalsQuery = ({ due, page, sort, status }: ListParams) => ({
	archived: status === 'archived' ? ('true' as const) : ('false' as const),
	...SORT_QUERY[sort],
	page: String(page),
	pageSize: String(PAGE_SIZE),
	...(status !== 'archived' && { status }),
	...(due !== 'all' && { due }),
});

export function useGoalList(params: ListParams) {
	return useQuery({
		placeholderData: keepPreviousData,
		queryFn: () => unwrapPage(api.goals.$get({ query: goalsQuery(params) })),
		queryKey: goalsKey(params),
	});
}

/** Every goal query (lists, searches, the goal picker of Projects) refetches after a change. */
function useRefreshGoals() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: ['goals'] });
}

export function useCreateGoal() {
	const refresh = useRefreshGoals();
	return useMutation({ mutationFn: (json: CreateGoalBody) => unwrap(api.goals.$post({ json })), onSuccess: refresh });
}

export function useUpdateGoal() {
	const refresh = useRefreshGoals();
	return useMutation({
		mutationFn: ({ changes, id }: { changes: UpdateGoalBody; id: string }) => unwrap(api.goals[':id'].$patch({ json: changes, param: { id } })),
		onSuccess: refresh,
	});
}

export function useSetGoalArchived() {
	const refresh = useRefreshGoals();
	return useMutation({
		mutationFn: ({ archived, id }: { archived: boolean; id: string }) => unwrap(archived ? api.goals[':id'].archive.$post({ param: { id } }) : api.goals[':id'].unarchive.$post({ param: { id } })),
		onSuccess: refresh,
	});
}

export type BulkAction = { status: GoalStatus } | { archived: boolean };

/** The API has no batch endpoint: one request per goal, so a partial failure surfaces as a toast and the list refetches. */
export function useBulkGoalAction() {
	const refresh = useRefreshGoals();
	return useMutation({
		mutationFn: async ({ action, ids }: { action: BulkAction; ids: string[] }) => {
			await Promise.all(
				ids.map(id => {
					if ('status' in action) return unwrap(api.goals[':id'].$patch({ json: { status: action.status }, param: { id } }));
					return unwrap(action.archived ? api.goals[':id'].archive.$post({ param: { id } }) : api.goals[':id'].unarchive.$post({ param: { id } }));
				})
			);
			return ids.length;
		},
		onSettled: refresh,
	});
}

/** The projects of a goal, for its drawer (read-only there; archived projects are not listed). */
export function useGoalProjects(goalId: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.projects.$get({ query: { goalId, pageSize: '50' } })), queryKey: ['goal-projects', goalId] });
}
