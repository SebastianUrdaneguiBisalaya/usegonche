import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@usegonche/api-client';
import { ArrowDownUp, Plus, Tag as TagIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router';
import { toast } from 'sonner';
import { Page } from '~/components/ui/layout/page/page';
import { useTranslate } from '~/hooks/use-translate';
import { API_BASE } from '~/lib/api';
import { ListSearch } from '../shared/list-search';
import { OptionSelect } from '../shared/option-select';
import { PAGE_SIZE } from '../shared/paged';
import { QuickAdd } from '../shared/quick-add';
import { QuickAddDialog } from '../shared/quick-add-dialog';
import { listStyles } from '../shared/styles';
import { useCreateTag } from '../shared/tags';
import { type Tag, type TagsPage, tagsKey, tagsQuery, useTagList } from './api';
import { DeleteTagsDialog } from './components/delete-tags-dialog';
import { EditTagModal } from './components/edit-tag-modal';
import { TagColorField } from './components/tag-color-field';
import { TagsTable } from './components/tags-table';
import { NAME_MAX } from './schemas';
import { loadTagsParams, type TagSort, tagParsers, tagSorts } from './search-params';

interface LoaderData {
	data: TagsPage;
	params: { page: number; q: string; sort: string };
}

/**
 * Loads the first page on the server from the URL's params (the request cookie is forwarded: a parent loader does not protect this one).
 * Without the cookie the client-side query takes over behind skeleton rows.
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData | null> {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	const params = loadTagsParams(request);
	const res = await createClient(API_BASE, { headers: { cookie } })
		.tags.$get({ query: tagsQuery(params) })
		.catch(() => undefined);
	// The API's 401 comes from its global middleware, so it is not part of the inferred response type.
	const status: number | undefined = res?.status;
	if (status === 401) throw redirect('/auth/sign-in');
	if (!res?.ok) return null;
	return { data: (await res.json()) as TagsPage, params };
}

const emptyIds: ReadonlySet<string> = new Set();

export default function TagsRoute() {
	const t = useTranslate();
	const queryClient = useQueryClient();
	const loaderData = useLoaderData<typeof loader>();
	const [params, setParams] = useQueryStates(tagParsers, { clearOnDefault: true });
	const page = Math.max(1, params.page);

	// Seeds the cache with what the loader resolved, so the first render already has the page (no extra request, no skeleton).
	if (loaderData) {
		const key = tagsKey({ page: loaderData.params.page, q: loaderData.params.q, sort: loaderData.params.sort as TagSort });
		if (queryClient.getQueryData(key) === undefined) queryClient.setQueryData(key, loaderData.data);
	}

	const list = useTagList({ page, q: params.q, sort: params.sort });
	const rows = useMemo(() => list.data?.data ?? [], [list.data]);
	const meta = list.data?.meta;
	const pageCount = meta?.pageCount ?? 1;

	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(emptyIds);
	// A selection belongs to one page of one view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the view changes.
	useEffect(() => setSelectedIds(emptyIds), [page, params.sort, params.q]);

	const [newColor, setNewColor] = useState('');
	const [editing, setEditing] = useState<Tag | undefined>(undefined);
	const [deleting, setDeleting] = useState<Tag[] | undefined>(undefined);
	const create = useCreateTag();
	const sortOptions = useMemo(() => tagSorts.map(value => ({ label: t(`tags.sort.${value}`), value })), [t]);

	return (
		<Fragment>
			<Page.Header>
				<div>
					<Page.Title>{t('tags.title')}</Page.Title>
					<Page.Description>{t('tags.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<ListSearch
						clearLabel={t('tags.search.clear')}
						label={t('tags.search.label')}
						onChange={q => void setParams({ page: 1, q })}
						placeholder={t('tags.search.placeholder')}
						value={params.q}
					/>
					<QuickAddDialog label={t('tags.add.label')}>
						<QuickAdd
							extra={<TagColorField onChange={setNewColor} value={newColor} />}
							icon={TagIcon}
							label={t('tags.add.label')}
							maxLength={NAME_MAX}
							onSubmit={async name => {
								await create.mutateAsync({ ...(newColor && { color: newColor }), name });
								setNewColor('');
							}}
							pending={create.isPending}
							placeholder={t('tags.add.placeholder')}
							submitIcon={Plus}
							submitLabel={t('tags.add.submit')}
						/>
					</QuickAddDialog>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<div className='flex flex-wrap items-center justify-end gap-3'>
					<OptionSelect icon={ArrowDownUp} label={t('tags.sort.label')} onChange={(sort: TagSort) => void setParams({ page: 1, sort })} options={sortOptions} value={params.sort} />
				</div>
				<TagsTable
					error={list.isError}
					isLoading={list.isPending || (list.isPlaceholderData && list.isFetching && rows.length === 0)}
					onDelete={setDeleting}
					onPageChange={next => void setParams({ page: next })}
					onEdit={setEditing}
					onRetry={() => void list.refetch()}
					onSelectedIdsChange={setSelectedIds}
					page={meta?.page ?? page}
					pageCount={pageCount}
					pageSize={PAGE_SIZE}
					rows={rows}
					searching={params.q.length > 0}
					selectedIds={selectedIds}
					total={meta?.total ?? 0}
				/>
			</Page.Body>
			<EditTagModal onClose={() => setEditing(undefined)} tag={editing} />
			<DeleteTagsDialog onClose={() => setDeleting(undefined)} onDeleted={() => setSelectedIds(emptyIds)} tags={deleting} />
		</Fragment>
	);
}
