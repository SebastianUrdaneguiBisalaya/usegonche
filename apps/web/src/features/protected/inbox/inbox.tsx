import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@usegonche/api-client';
import { useQueryStates } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router';
import { toast } from 'sonner';
import { Page } from '~/components/ui/layout/page/page';
import { useTranslate } from '~/hooks/use-translate';
import { API_BASE } from '~/lib/api';
import { ListSearch } from '../shared/list-search';
import { PAGE_SIZE } from '../shared/paged';
import { StatusTabs } from '../shared/status-tabs';
import { type ConvertTarget, type InboxPage, inboxKey, inboxQuery, type SettableStatus, useBulkSetStatus, useConvert, useInbox, useInboxSearch, useSetStatus } from './api';
import { BrainDump } from './components/brain-dump';
import { type InboxRow, InboxTable } from './components/inbox-table';
import { QuickCapture } from './components/quick-capture';
import { RangeSelect } from './components/range-select';
import { SelectionBar } from './components/selection-bar';
import { inboxParsers, inboxStatuses, loadInboxParams } from './search-params';

interface LoaderData {
	data: InboxPage;
	params: { page: number; range: string; status: string };
}

/**
 * Loads the first page on the server from the URL's params (the request cookie is forwarded: a parent loader does not protect this one).
 * A search (`?q=`) is fetched by the client, and without the cookie the client-side query takes over behind skeleton rows.
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData | null> {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	const params = loadInboxParams(request);
	if (params.q) return null;
	const res = await createClient(API_BASE, { headers: { cookie } })
		.inbox.$get({ query: inboxQuery(params) })
		.catch(() => undefined);
	// The API's 401 comes from its global middleware, so it is not part of the inferred response type.
	const status: number | undefined = res?.status;
	if (status === 401) throw redirect('/auth/sign-in');
	if (!res?.ok) return null;
	return { data: (await res.json()) as InboxPage, params };
}

const emptyIds: ReadonlySet<string> = new Set();

export default function InboxPage() {
	const t = useTranslate();
	const queryClient = useQueryClient();
	const loaderData = useLoaderData<typeof loader>();
	const [params, setParams] = useQueryStates(inboxParsers, { clearOnDefault: true });
	const page = Math.max(1, params.page);
	const searching = params.q.length > 0;

	// Seeds the cache with what the loader resolved, so the first render already has the page (no extra request, no skeleton).
	if (loaderData) {
		const key = inboxKey({ page: loaderData.params.page, range: loaderData.params.range as typeof params.range, status: loaderData.params.status as typeof params.status });
		if (queryClient.getQueryData(key) === undefined) queryClient.setQueryData(key, loaderData.data);
	}

	const list = useInbox({ page, range: params.range, status: params.status }, !searching);
	const search = useInboxSearch({ page, q: params.q });
	const active = searching ? search : list;
	const counts = list.data?.meta.counts;

	const rows = useMemo<InboxRow[]>(() => {
		if (searching) return (search.data?.data ?? []).map(hit => ({ at: hit.updatedAt, content: hit.title, id: hit.id }));
		return (list.data?.data ?? []).map(item => ({ at: item.capturedAt, content: item.content, id: item.id, source: item.source, status: item.status }));
	}, [list.data, search.data, searching]);

	const meta = active.data?.meta;
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(emptyIds);
	// A selection belongs to one page of one view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the view changes.
	useEffect(() => setSelectedIds(emptyIds), [page, params.status, params.range, params.q]);

	const setStatus = useSetStatus();
	const bulk = useBulkSetStatus();
	const convert = useConvert();

	const onSetStatus = useCallback(
		(row: InboxRow, status: SettableStatus) => {
			const previous = row.status === 'pending' || row.status === 'archived' || row.status === 'discarded' ? row.status : 'pending';
			setStatus.mutate(
				{ id: row.id, status },
				{
					onSuccess: () => {
						const message = status === 'archived' ? t('inbox.toast.archived') : status === 'discarded' ? t('inbox.toast.discarded') : t('inbox.toast.restored');
						// Restoring is its own undo target: undoing a restore would need the source status, which is `previous`.
						if (status === 'pending') toast.success(message);
						else toast.success(message, { action: { label: t('inbox.toast.undo'), onClick: () => setStatus.mutate({ id: row.id, status: previous }) } });
					},
				}
			);
		},
		[setStatus, t]
	);

	const onConvert = useCallback(
		(row: InboxRow, target: ConvertTarget) => {
			convert.mutate(
				{ item: row, target },
				{ onSuccess: () => toast.success(t(target === 'task' ? 'inbox.toast.convertedTask' : target === 'project' ? 'inbox.toast.convertedProject' : 'inbox.toast.convertedNote')) }
			);
		},
		[convert, t]
	);

	const statusTabs = useMemo(() => inboxStatuses.map(value => ({ label: t(`inbox.tabs.${value}`), value })), [t]);

	const pageIds = rows.map(row => row.id);
	const selectedOnPage = pageIds.filter(id => selectedIds.has(id)).length;
	const selectable = !searching && params.status !== 'converted';

	const emptyKind = searching ? 'search' : params.status;

	return (
		<Page.Root className='min-h-0 flex-1' size='full'>
			<Page.Header>
				<div>
					<Page.Title>{t('inbox.title')}</Page.Title>
					<Page.Description>{t('inbox.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<ListSearch
						clearLabel={t('inbox.search.clear')}
						label={t('inbox.search.label')}
						onChange={q => void setParams({ page: 1, q })}
						placeholder={t('inbox.search.placeholder')}
						value={params.q}
					/>
					<RangeSelect onChange={range => void setParams({ page: 1, range })} value={params.range} />
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-5'>
				<QuickCapture />
				<BrainDump />
				<div className='flex min-h-0 flex-1 flex-col gap-4'>
					<div className='flex flex-wrap items-center justify-between gap-3'>
						<StatusTabs ariaLabel={t('inbox.tabs.label')} counts={counts} onChange={status => void setParams({ page: 1, q: '', status })} tabs={statusTabs} value={params.status} />
						{selectable && (
							<SelectionBar
								allSelected={pageIds.length > 0 && selectedOnPage === pageIds.length}
								disabled={rows.length === 0}
								onClear={() => setSelectedIds(emptyIds)}
								onSetStatus={status => {
									// Items already in the target status are left alone.
									const ids = [...selectedIds].filter(id => rows.find(row => row.id === id)?.status !== status);
									if (ids.length === 0) return setSelectedIds(emptyIds);
									bulk.mutate(
										{ ids, status },
										{
											onSuccess: count => {
												setSelectedIds(emptyIds);
												toast.success(t('inbox.toast.bulk', { count }));
											},
										}
									);
								}}
								onToggleAll={checked => setSelectedIds(checked ? new Set(pageIds) : emptyIds)}
								selectedCount={selectedIds.size}
								someSelected={selectedOnPage > 0 && selectedOnPage < pageIds.length}
								status={params.status}
							/>
						)}
					</div>
					<InboxTable
						emptyKind={emptyKind}
						error={active.isError}
						isLoading={active.isPending || (active.isPlaceholderData && active.isFetching && rows.length === 0)}
						onConvert={onConvert}
						onPageChange={next => void setParams({ page: next })}
						onRetry={() => void active.refetch()}
						onSelectedIdsChange={setSelectedIds}
						onSetStatus={onSetStatus}
						page={meta?.page ?? page}
						pageCount={meta?.pageCount ?? 1}
						pageSize={PAGE_SIZE}
						rangeActive={params.range !== 'all'}
						rows={rows}
						selectable={selectable}
						selectedIds={selectedIds}
						total={meta?.total ?? 0}
					/>
				</div>
			</Page.Body>
		</Page.Root>
	);
}
