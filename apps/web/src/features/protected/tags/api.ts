import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { type OkBody, PAGE_SIZE, unwrapPage } from '../shared/paged';
import type { TagsParams } from './search-params';

type TagsResponse = Awaited<ReturnType<typeof api.tags.$get>>;

/** One page of `GET /tags`: the tags with where each is used, and the page meta. */
export type TagsPage = OkBody<TagsResponse>;
export type Tag = TagsPage['data'][number];

const SORT_QUERY = {
	created: { order: 'desc', sort: 'createdAt' },
	name: { order: 'asc', sort: 'name' },
	notes: { order: 'desc', sort: 'notes' },
	projects: { order: 'desc', sort: 'projects' },
	tasks: { order: 'desc', sort: 'tasks' },
	updated: { order: 'desc', sort: 'updatedAt' },
} as const;

export type UpdateTagBody = Body<(typeof api.tags)[':id']['$patch']>;

export const tagsKey = (params: TagsParams) => ['tags', 'list', params] as const;

/** Query string of `GET /tags` (values are strings on the wire). The search (`q`) is the API's name filter. */
export const tagsQuery = ({ page, q, sort }: TagsParams) => ({ ...SORT_QUERY[sort], page: String(page), pageSize: String(PAGE_SIZE), ...(q && { q }) });

export function useTagList(params: TagsParams) {
	return useQuery({ placeholderData: keepPreviousData, queryFn: () => unwrapPage(api.tags.$get({ query: tagsQuery(params) })), queryKey: tagsKey(params) });
}

/** Tags show on projects too (names, filters), so an edit or a delete refreshes them as well. */
function useRefreshTags() {
	const queryClient = useQueryClient();
	return () => Promise.all([queryClient.invalidateQueries({ queryKey: ['tags'] }), queryClient.invalidateQueries({ queryKey: ['projects'] })]);
}

export function useUpdateTag() {
	const refresh = useRefreshTags();
	return useMutation({ mutationFn: ({ changes, id }: { changes: UpdateTagBody; id: string }) => unwrap(api.tags[':id'].$patch({ json: changes, param: { id } })), onSuccess: refresh });
}

/** The API has no batch endpoint: one request per tag, so a partial failure surfaces as a toast and the list refetches. */
export function useDeleteTags() {
	const refresh = useRefreshTags();
	return useMutation({
		mutationFn: async (ids: string[]) => {
			await Promise.all(ids.map(id => unwrap(api.tags[':id'].$delete({ param: { id } }))));
			return ids.length;
		},
		onSettled: refresh,
	});
}
