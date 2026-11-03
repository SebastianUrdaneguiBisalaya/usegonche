import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { type OkBody, PAGE_SIZE, unwrapPage } from '../shared/paged';
import type { InboxParams, InboxStatus } from './search-params';

type InboxResponse = Awaited<ReturnType<typeof api.inbox.$get>>;

/** One page of `GET /inbox`: the items, the page meta and the counter of every status tab. */
export type InboxPage = OkBody<InboxResponse>;
export type InboxItem = InboxPage['data'][number];

export const inboxKey = ({ page, range, status }: Pick<InboxParams, 'page' | 'range' | 'status'>) => ['inbox', 'list', { page, range, status }] as const;

/** Query string of `GET /inbox` (values are strings on the wire). */
export const inboxQuery = ({ page, range, status }: Pick<InboxParams, 'page' | 'range' | 'status'>) => ({ page: String(page), pageSize: String(PAGE_SIZE), range, status });

export function useInbox(params: Pick<InboxParams, 'page' | 'range' | 'status'>) {
	return useQuery({
		placeholderData: keepPreviousData,
		queryFn: () => unwrapPage(api.inbox.$get({ query: inboxQuery(params) })),
		queryKey: inboxKey(params),
	});
}

/** Every inbox query (lists, searches) refetches after a change. */
function useRefreshInbox() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: ['inbox'] });
}

export type SettableStatus = Exclude<InboxStatus, 'converted'>;

export function useSetStatus() {
	const refresh = useRefreshInbox();
	return useMutation({
		mutationFn: ({ id, status }: { id: string; status: SettableStatus }) => unwrap(api.inbox[':id'].$patch({ json: { status }, param: { id } })),
		onSuccess: refresh,
	});
}

/** The API has no batch endpoint: one `PATCH` per item, all or nothing is not guaranteed, so failures surface as a toast and the list refetches. */
export function useBulkSetStatus() {
	const refresh = useRefreshInbox();
	return useMutation({
		mutationFn: async ({ ids, status }: { ids: string[]; status: SettableStatus }) => {
			await Promise.all(ids.map(id => unwrap(api.inbox[':id'].$patch({ json: { status }, param: { id } }))));
			return ids.length;
		},
		onSettled: refresh,
	});
}

export function useCapture() {
	const refresh = useRefreshInbox();
	return useMutation({
		mutationFn: (content: string) => unwrap(api.inbox.$post({ json: { content } })),
		onSuccess: refresh,
	});
}

export function useBrainDump() {
	const refresh = useRefreshInbox();
	return useMutation({
		mutationFn: (text: string) => unwrap(api.inbox['brain-dump'].$post({ json: { text } })),
		onSuccess: refresh,
	});
}

export type ConvertTarget = 'note' | 'project' | 'task';

const TITLE_MAX = 200;

/** The inbox item becomes a task, project or note in one transaction (`originInboxItemId`); a long text keeps its full content in the description/body. */
export function useConvert() {
	const queryClient = useQueryClient();
	const refresh = useRefreshInbox();
	return useMutation({
		mutationFn: async ({ item, target }: { item: Pick<InboxItem, 'content' | 'id'>; target: ConvertTarget }): Promise<void> => {
			const title = item.content.slice(0, TITLE_MAX).trim();
			const rest = item.content.length > TITLE_MAX ? item.content : undefined;
			const originInboxItemId = item.id;
			if (target === 'task') await unwrap(api.tasks.$post({ json: { description: rest, originInboxItemId, title } as Body<typeof api.tasks.$post> }));
			else if (target === 'project') await unwrap(api.projects.$post({ json: { description: rest, originInboxItemId, title } as Body<typeof api.projects.$post> }));
			else await unwrap(api.notes.$post({ json: { body: rest, originInboxItemId, title } as Body<typeof api.notes.$post> }));
		},
		onSuccess: async (_, { target }) => {
			if (target === 'note') await Promise.all([['notes'], ['tasks', 'notes'], ['project-notes']].map(queryKey => queryClient.invalidateQueries({ queryKey })));
			await refresh();
		},
	});
}
