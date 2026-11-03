import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { toDateOnly } from '../shared/dates';
import { type OkBody, PAGE_SIZE, unwrapPage } from '../shared/paged';
import { NO_PROJECT, type TaskSort, type TasksParams, type TaskView } from './search-params';

type TasksResponse = Awaited<ReturnType<typeof api.tasks.$get>>;

/** One page of `GET /tasks`: the tasks, the page meta and the counters (`todo`, `in_progress`, `done`, `cancelled`, `blocked`, `overdue`). */
export type TasksPage = OkBody<TasksResponse>;
export type Task = TasksPage['data'][number];
export type TaskCounts = TasksPage['meta']['counts'];

export type CreateTaskBody = Body<typeof api.tasks.$post>;
export type UpdateTaskBody = Body<(typeof api.tasks)[':id']['$patch']>;
export type BulkChanges = Body<typeof api.tasks.bulk.$patch>['changes'];

/** The board loads one big page (the API caps a page at 100); the list pages through the tasks. */
export const BOARD_PAGE_SIZE = 100;

const SORT_QUERY: Record<TaskSort, { order: 'asc' | 'desc'; sort: 'createdAt' | 'dueDate' | 'priority' | 'title' | 'updatedAt' }> = {
	created: { order: 'desc', sort: 'createdAt' },
	due: { order: 'asc', sort: 'dueDate' },
	priority: { order: 'desc', sort: 'priority' },
	title: { order: 'asc', sort: 'title' },
	updated: { order: 'desc', sort: 'updatedAt' },
};

const shiftDay = (days: number): string => {
	const now = new Date();
	return toDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
};

export const tasksKey = (view: TaskView, params: TasksParams) => ['tasks', 'list', view, params, shiftDay(0)] as const;

/** Query string of `GET /tasks` (values are strings on the wire). The due filter becomes a date range, as the API knows no "overdue". */
export const tasksQuery = (view: TaskView, { blocked, due, goal, page, project, sort, status, tag }: TasksParams) => ({
	// An overdue task is an open one: the status chips cannot bring the finished ones back into that filter.
	...(due === 'overdue' ? { dueBefore: shiftDay(-1), status: status.filter(value => value === 'todo' || value === 'in_progress') } : { status }),
	...(due === 'today' && { dueAfter: shiftDay(0), dueBefore: shiftDay(0) }),
	...(due === 'week' && { dueAfter: shiftDay(0), dueBefore: shiftDay(6) }),
	...(due === 'none' && { noDueDate: 'true' as const }),
	...(blocked && { blocked: 'true' as const }),
	...(goal && { goalId: goal }),
	...(project === NO_PROJECT ? { noProject: 'true' as const } : project ? { projectId: project } : {}),
	...(tag && { tagId: tag }),
	...SORT_QUERY[sort],
	page: view !== 'list' ? '1' : String(page),
	pageSize: String(view !== 'list' ? BOARD_PAGE_SIZE : PAGE_SIZE),
});

export function useTasks(view: TaskView, params: TasksParams, enabled = true) {
	return useQuery({
		enabled,
		placeholderData: keepPreviousData,
		queryFn: () => unwrapPage(api.tasks.$get({ query: tasksQuery(view, params) })),
		queryKey: tasksKey(view, params),
	});
}

/** The subtasks of one parent (single level), fetched when its row is expanded or its drawer opens. */
export function useSubtasks(parentId: string, enabled: boolean) {
	return useQuery({
		enabled,
		queryFn: () => unwrap(api.tasks.$get({ query: { pageSize: String(BOARD_PAGE_SIZE), parentId, order: 'asc', sort: 'createdAt' } })),
		queryKey: ['tasks', 'subtasks', parentId],
	});
}

/** One task, for the drawer: it keeps showing fresh values (blocked, dependencies) after any change. */
export function useTask(id: string | undefined) {
	return useQuery({ enabled: id !== undefined, queryFn: () => unwrap(api.tasks[':id'].$get({ param: { id: id ?? '' } })), queryKey: ['tasks', 'one', id] });
}

export function useGoalOptions() {
	return useQuery({ queryFn: () => unwrap(api.goals.$get({ query: { pageSize: '100' } })), queryKey: ['goals', 'options'], staleTime: 60_000 });
}

/** Everything that depends on tasks refetches after a change (lists, subtasks, the drawer's task). */
function useRefreshTasks() {
	const queryClient = useQueryClient();
	return () => Promise.all([queryClient.invalidateQueries({ queryKey: ['tasks'] }), queryClient.invalidateQueries({ queryKey: ['projects'] })]);
}

type Rollback = () => void;
type Patch = Partial<Pick<Task, 'dueDate' | 'priority' | 'startDate' | 'status'>>;

/** Applies a change to the task in every cached list at once, so a drag or an inline edit shows up before the request answers. */
function patchCachedTasks(queryClient: QueryClient, ids: readonly string[], patch: Patch): Rollback {
	const snapshots = queryClient.getQueriesData<TasksPage>({ queryKey: ['tasks', 'list'] });
	for (const [key, page] of snapshots) {
		if (!page) continue;
		queryClient.setQueryData<TasksPage>(key, { ...page, data: page.data.map(task => (ids.includes(task.id) ? { ...task, ...patch } : task)) });
	}
	return () => {
		for (const [key, page] of snapshots) queryClient.setQueryData(key, page);
	};
}

const toOptimistic = (changes: UpdateTaskBody): Patch => ({
	...(changes.status && { status: changes.status }),
	...(changes.priority && { priority: changes.priority }),
	...(changes.dueDate !== undefined && { dueDate: changes.dueDate === null ? null : `${String(changes.dueDate).slice(0, 10)}T00:00:00.000Z` }),
});

export function useCreateTask() {
	const refresh = useRefreshTasks();
	return useMutation({ mutationFn: (json: CreateTaskBody) => unwrap(api.tasks.$post({ json })), onSuccess: refresh });
}

export function useUpdateTask() {
	const queryClient = useQueryClient();
	const refresh = useRefreshTasks();
	return useMutation({
		mutationFn: ({ changes, id }: { changes: UpdateTaskBody; id: string }) => unwrap(api.tasks[':id'].$patch({ json: changes, param: { id } })),
		onError: (_error, _vars, rollback) => (rollback as Rollback | undefined)?.(),
		onMutate: ({ changes, id }) => patchCachedTasks(queryClient, [id], toOptimistic(changes)),
		onSettled: refresh,
	});
}

export function useDeleteTask() {
	const refresh = useRefreshTasks();
	return useMutation({ mutationFn: (id: string) => unwrap(api.tasks[':id'].$delete({ param: { id } })), onSuccess: refresh });
}

/** `PATCH /tasks/bulk`: one atomic request for every selected task (up to 50). */
export function useBulkUpdate() {
	const queryClient = useQueryClient();
	const refresh = useRefreshTasks();
	return useMutation({
		mutationFn: ({ changes, ids }: { changes: BulkChanges; ids: string[] }) => unwrap(api.tasks.bulk.$patch({ json: { changes, ids } })),
		onError: (_error, _vars, rollback) => (rollback as Rollback | undefined)?.(),
		onMutate: ({ changes, ids }) => patchCachedTasks(queryClient, ids, toOptimistic(changes as UpdateTaskBody)),
		onSettled: refresh,
	});
}

export const BULK_MAX = 50;

/** Dependencies: this task waits for another. The API refuses cycles (409) and self-dependency (422). */
export function useAddDependency() {
	const refresh = useRefreshTasks();
	return useMutation({
		mutationFn: ({ dependsOnId, id }: { dependsOnId: string; id: string }) => unwrap(api.tasks[':id'].dependencies.$post({ json: { dependsOnId }, param: { id } })),
		onSuccess: refresh,
	});
}

export function useRemoveDependency() {
	const refresh = useRefreshTasks();
	return useMutation({
		mutationFn: ({ dependsOnId, id }: { dependsOnId: string; id: string }) => unwrap(api.tasks[':id'].dependencies[':dependsOnId'].$delete({ param: { dependsOnId, id } })),
		onSuccess: refresh,
	});
}

export function useBlockers(id: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.tasks[':id'].blockers.$get({ param: { id } })), queryKey: ['tasks', 'blockers', id] });
}

export function useCreateBlocker() {
	const refresh = useRefreshTasks();
	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.tasks[':id'].blockers.$post({ json: { reason }, param: { id } })),
		onSuccess: refresh,
	});
}

export function useResolveBlocker() {
	const refresh = useRefreshTasks();
	return useMutation({
		mutationFn: ({ blockerId, id }: { blockerId: string; id: string }) => unwrap(api.tasks[':id'].blockers[':blockerId'].resolve.$post({ param: { blockerId, id } })),
		onSuccess: refresh,
	});
}

export function useTaskHistory(id: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.tasks[':id'].history.$get({ param: { id }, query: { pageSize: '50' } })), queryKey: ['tasks', 'history', id] });
}

export function useTaskNotes(taskId: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.notes.$get({ query: { pageSize: '50', taskId } })), queryKey: ['tasks', 'notes', taskId] });
}

export function useTaskFiles(taskId: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.attachments.$get({ query: { pageSize: '50', taskId } })), queryKey: ['tasks', 'files', taskId] });
}

/** The time blocks planned for the task, all of them (no date range needed when the filter is a task). */
export function useTaskBlocks(taskId: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.planning.blocks.$get({ query: { taskId } })), queryKey: ['tasks', 'blocks', taskId] });
}

const CYCLE_SEARCH_LIMIT = 40;

/**
 * Previews the cycle that making `taskId` wait for `candidateId` would close, before confirming: walks the "waits for" edges from the
 * candidate and, when it reaches `taskId`, answers the chain of task ids (`taskId`'s new dependency first, `taskId` last). `null`
 * means no cycle. The API refuses a cycle anyway (409): this only explains it up front.
 */
export function useCyclePreview(taskId: string, candidateId: string | undefined) {
	return useQuery({
		enabled: candidateId !== undefined && candidateId !== taskId,
		queryFn: async (): Promise<{ chain: { id: string; title: string }[] } | null> => {
			const start = candidateId ?? '';
			const via = new Map<string, string | null>([[start, null]]);
			const titles = new Map<string, string>();
			const queue = [start];
			for (let visited = 0; queue.length > 0 && visited < CYCLE_SEARCH_LIMIT; visited++) {
				const id = queue.shift() ?? '';
				const task = await unwrap(api.tasks[':id'].$get({ param: { id } }));
				titles.set(id, task.title);
				for (const dependency of task.dependsOnIds) {
					if (via.has(dependency)) continue;
					via.set(dependency, id);
					if (dependency !== taskId) {
						queue.push(dependency);
						continue;
					}
					// Walks back from the task that waits for `taskId` to the candidate.
					const chain: { id: string; title: string }[] = [];
					for (let cursor: string | null | undefined = id; cursor; cursor = via.get(cursor)) chain.unshift({ id: cursor, title: titles.get(cursor) ?? '' });
					return { chain };
				}
			}
			return null;
		},
		queryKey: ['tasks', 'cycle', taskId, candidateId],
		staleTime: 0,
	});
}
