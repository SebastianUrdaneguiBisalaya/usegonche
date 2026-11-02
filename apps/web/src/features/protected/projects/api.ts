import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { type OkBody, PAGE_SIZE, unwrapPage } from '../shared/paged';
import type { ProjectStatus, ProjectsParams } from './search-params';

type ProjectsResponse = Awaited<ReturnType<typeof api.projects.$get>>;
type SearchResponse = Awaited<ReturnType<typeof api.search.$get>>;

/** One page of `GET /projects`: the projects, the page meta and the counter of every status tab. */
export type ProjectsPage = OkBody<ProjectsResponse>;
export type Project = ProjectsPage['data'][number];
/** One page of `GET /search?types=project`. */
export type ProjectSearchPage = OkBody<SearchResponse>;

export type CreateProjectBody = Body<typeof api.projects.$post>;
export type UpdateProjectBody = Body<(typeof api.projects)[':id']['$patch']>;

type ListParams = Pick<ProjectsParams, 'goal' | 'page' | 'sort' | 'status' | 'tag'>;

const SORT_QUERY = {
	created: { order: 'desc', sort: 'createdAt' },
	title: { order: 'asc', sort: 'title' },
	updated: { order: 'desc', sort: 'updatedAt' },
} as const;

export const projectsKey = (params: ListParams) => ['projects', 'list', params] as const;
export const projectsSearchKey = ({ page, q }: Pick<ProjectsParams, 'page' | 'q'>) => ['projects', 'search', { page, q }] as const;

/** Query string of `GET /projects` (values are strings on the wire). The order is the one picked on the page. */
export const projectsQuery = ({ goal, page, sort, status, tag }: ListParams) => ({
	archived: status === 'archived' ? ('true' as const) : ('false' as const),
	...SORT_QUERY[sort],
	page: String(page),
	pageSize: String(PAGE_SIZE),
	...(status !== 'archived' && { status }),
	...(goal && { goalId: goal }),
	...(tag && { tagId: tag }),
});

export function useProjects(params: ListParams, enabled: boolean) {
	return useQuery({
		enabled,
		placeholderData: keepPreviousData,
		queryFn: () => unwrapPage(api.projects.$get({ query: projectsQuery(params) })),
		queryKey: projectsKey(params),
	});
}

export function useProjectsSearch({ page, q }: Pick<ProjectsParams, 'page' | 'q'>) {
	return useQuery({
		enabled: q.length > 0,
		placeholderData: keepPreviousData,
		queryFn: () => unwrapPage(api.search.$get({ query: { page: String(page), pageSize: String(PAGE_SIZE), q, types: 'project' } })),
		queryKey: projectsSearchKey({ page, q }),
	});
}

/** The goals a project can belong to (the API caps a page at 100, plenty for a personal list). */
export function useGoals() {
	return useQuery({ queryFn: () => unwrap(api.goals.$get({ query: { pageSize: '100' } })), queryKey: ['goals', 'options'], staleTime: 60_000 });
}

export function useTags() {
	return useQuery({ queryFn: () => unwrap(api.tags.$get()), queryKey: ['tags'], staleTime: 60_000 });
}

/** Every project query (lists, searches) refetches after a change. */
function useRefreshProjects() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: ['projects'] });
}

export function useCreateProject() {
	const refresh = useRefreshProjects();
	return useMutation({ mutationFn: (json: CreateProjectBody) => unwrap(api.projects.$post({ json })), onSuccess: refresh });
}

export function useUpdateProject() {
	const refresh = useRefreshProjects();
	return useMutation({
		mutationFn: ({ changes, id }: { changes: UpdateProjectBody; id: string }) => unwrap(api.projects[':id'].$patch({ json: changes, param: { id } })),
		onSuccess: refresh,
	});
}

export function useSetArchived() {
	const refresh = useRefreshProjects();
	return useMutation({
		mutationFn: ({ archived, id }: { archived: boolean; id: string }) =>
			unwrap(archived ? api.projects[':id'].archive.$post({ param: { id } }) : api.projects[':id'].unarchive.$post({ param: { id } })),
		onSuccess: refresh,
	});
}

export type BulkAction = { status: ProjectStatus } | { archived: boolean };

/** The API has no batch endpoint: one request per project, so a partial failure surfaces as a toast and the list refetches. */
export function useBulkAction() {
	const refresh = useRefreshProjects();
	return useMutation({
		mutationFn: async ({ action, ids }: { action: BulkAction; ids: string[] }) => {
			await Promise.all(
				ids.map(id => {
					if ('status' in action) return unwrap(api.projects[':id'].$patch({ json: { status: action.status }, param: { id } }));
					return unwrap(action.archived ? api.projects[':id'].archive.$post({ param: { id } }) : api.projects[':id'].unarchive.$post({ param: { id } }));
				})
			);
			return ids.length;
		},
		onSettled: refresh,
	});
}

/** Creates a tag on the fly (from the tag picker) and refreshes the list of tags before resolving. */
export function useCreateTag() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => unwrap(api.tags.$post({ json: { name } })),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
	});
}

/** What the drawer shows next to the form: the tasks, notes and files that belong to the project (read-only here). */
export function useProjectTasks(projectId: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.tasks.$get({ query: { pageSize: '50', projectId } })), queryKey: ['project-tasks', projectId] });
}

export function useProjectNotes(projectId: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.notes.$get({ query: { pageSize: '50', projectId } })), queryKey: ['project-notes', projectId] });
}

export function useProjectFiles(projectId: string, enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.attachments.$get({ query: { pageSize: '50', projectId } })), queryKey: ['project-files', projectId] });
}
