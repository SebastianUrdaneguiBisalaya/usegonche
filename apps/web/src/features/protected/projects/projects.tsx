import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@usegonche/api-client';
import { ArrowDownUp, Plus } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Page } from '~/components/ui/layout/page/page';
import { useTranslate } from '~/hooks/use-translate';
import { API_BASE } from '~/lib/api';
import { OptionSelect } from '../shared/option-select';
import { PageSelect } from '../shared/page-select';
import { PAGE_SIZE } from '../shared/paged';
import { type StatusTab, StatusTabs } from '../shared/status-tabs';
import { listStyles } from '../shared/styles';
import { useTagOptions } from '../shared/tags';
import { type BulkAction, type Project, type ProjectsPage, projectsKey, projectsQuery, useBulkAction, useGoals, useProjects, useSetArchived, useUpdateProject } from './api';
import { GoalFilter, TagFilter } from './components/filters';
import { NewProjectModal } from './components/new-project-modal';
import { ProjectDrawer } from './components/project-drawer';
import { type ProjectRow, ProjectsTable } from './components/projects-table';
import { statusColor, statusIcon } from './display';
import { loadProjectsParams, type ProjectSort, type ProjectStatus, projectParsers, projectSorts, projectTabs } from './search-params';

interface LoaderData {
	data: ProjectsPage;
	params: { goal: string; page: number; sort: string; status: string; tag: string };
}

/**
 * Loads the first page on the server from the URL's params (the request cookie is forwarded: a parent loader does not protect this one).
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData | null> {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	const params = loadProjectsParams(request);
	const res = await createClient(API_BASE, { headers: { cookie } })
		.projects.$get({ query: projectsQuery(params) })
		.catch(() => undefined);
	// The API's 401 comes from its global middleware, so it is not part of the inferred response type.
	const status: number | undefined = res?.status;
	if (status === 401) throw redirect('/auth/sign-in');
	if (!res?.ok) return null;
	return { data: (await res.json()) as ProjectsPage, params };
}

const emptyIds: ReadonlySet<string> = new Set();

export default function ProjectsRoute() {
	const t = useTranslate();
	const queryClient = useQueryClient();
	const loaderData = useLoaderData<typeof loader>();
	const [params, setParams] = useQueryStates(projectParsers, { clearOnDefault: true });
	const page = Math.max(1, params.page);

	// Seeds the cache with what the loader resolved, so the first render already has the page (no extra request, no skeleton).
	if (loaderData) {
		const key = projectsKey({
			goal: loaderData.params.goal,
			page: loaderData.params.page,
			sort: loaderData.params.sort as typeof params.sort,
			status: loaderData.params.status as typeof params.status,
			tag: loaderData.params.tag,
		});
		if (queryClient.getQueryData(key) === undefined) queryClient.setQueryData(key, loaderData.data);
	}

	const list = useProjects({ goal: params.goal, page, sort: params.sort, status: params.status, tag: params.tag });
	const active = list;
	const counts = list.data?.meta.counts;
	const goals = useGoals();
	const tags = useTagOptions();

	const goalTitles = useMemo(() => new Map((goals.data ?? []).map(goal => [goal.id, goal.title])), [goals.data]);
	const goalOptions = useMemo(() => (goals.data ?? []).map(goal => ({ id: goal.id, name: goal.title })), [goals.data]);
	const tagOptions = useMemo(() => (tags.data ?? []).map(tag => ({ id: tag.id, name: tag.name })), [tags.data]);

	const rows = useMemo<ProjectRow[]>(() => {
		return (list.data?.data ?? []).map(project => ({ id: project.id, project, title: project.title, updatedAt: project.updatedAt }));
	}, [list.data]);

	const meta = active.data?.meta;
	const pageCount = meta?.pageCount ?? 1;
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(emptyIds);
	// A selection belongs to one page of one view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the view changes.
	useEffect(() => setSelectedIds(emptyIds), [page, params.status, params.goal, params.tag]);

	const [creating, setCreating] = useState(false);
	const [opened, setOpened] = useState<Project | undefined>(undefined);

	const update = useUpdateProject();
	const setArchived = useSetArchived();
	const bulk = useBulkAction();

	const onSetStatus = useCallback(
		(project: Project, status: ProjectStatus) => {
			const previous = project.status;
			update.mutate(
				{ changes: { status }, id: project.id },
				{
					onSuccess: () =>
						toast.success(t('projects.toast.statusChanged'), {
							action: { label: t('projects.toast.undo'), onClick: () => update.mutate({ changes: { status: previous }, id: project.id }) },
						}),
				}
			);
		},
		[t, update]
	);

	const onSetArchived = useCallback(
		(project: Project, archived: boolean) => {
			setArchived.mutate(
				{ archived, id: project.id },
				{
					onSuccess: () =>
						toast.success(archived ? t('projects.toast.archived') : t('projects.toast.restored'), {
							action: { label: t('projects.toast.undo'), onClick: () => setArchived.mutate({ archived: !archived, id: project.id }) },
						}),
				}
			);
		},
		[setArchived, t]
	);

	const onBulkAction = useCallback(
		(action: BulkAction) => {
			// Projects already in the target state are left alone.
			const byId = new Map((list.data?.data ?? []).map(project => [project.id, project]));
			const ids = [...selectedIds].filter(id => {
				const project = byId.get(id);
				if (!project) return true;
				return 'status' in action ? project.status !== action.status : Boolean(project.archivedAt) !== action.archived;
			});
			if (ids.length === 0) return setSelectedIds(emptyIds);
			bulk.mutate(
				{ action, ids },
				{
					onSuccess: count => {
						setSelectedIds(emptyIds);
						toast.success(t('projects.toast.bulk', { count }));
					},
				}
			);
		},
		[bulk, list.data, selectedIds, t]
	);

	const sortOptions = useMemo(() => projectSorts.map((value: ProjectSort) => ({ label: t(`projects.sort.${value}`), value })), [t]);

	const tabs = useMemo<StatusTab<(typeof projectTabs)[number]>[]>(
		() =>
			projectTabs.map(value => ({
				icon: statusIcon[value],
				iconClassName: `${statusColor[value]} ${value === 'active' ? 'fill-current' : ''}`,
				label: t(`projects.tabs.${value}`),
				value,
			})),
		[t]
	);

	return (
		<Fragment>
			<Page.Header>
				<div>
					<Page.Title>{t('projects.title')}</Page.Title>
					<Page.Description>{t('projects.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<Button className={listStyles.pillTrigger} onClick={() => setCreating(true)} variant='secondary'>
						<Button.Icon icon={Plus} />
						<Button.Text>{t('projects.new')}</Button.Text>
					</Button>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<div className={`${listStyles.card} overflow-x-auto p-3`}>
					<StatusTabs ariaLabel={t('projects.tabs.label')} counts={counts} onChange={status => void setParams({ page: 1, status })} tabs={tabs} value={params.status} />
				</div>
				<div className={`${listStyles.card} flex flex-wrap items-center justify-between gap-3 p-3`}>
					<div className='flex flex-wrap items-center gap-3'>
						<GoalFilter onChange={goal => void setParams({ goal, page: 1 })} options={goalOptions} value={params.goal} />
						<TagFilter onChange={tag => void setParams({ page: 1, tag })} options={tagOptions} value={params.tag} />
					</div>
					<div className='flex flex-wrap items-center gap-3'>
						<OptionSelect icon={ArrowDownUp} label={t('projects.sort.label')} onChange={sort => void setParams({ page: 1, sort })} options={sortOptions} value={params.sort} />
						<PageSelect
							label={t('projects.filters.page.label')}
							onChange={next => void setParams({ page: next })}
							page={meta?.page ?? page}
							pageCount={pageCount}
							valueLabel={t('projects.filters.page.value', { page: meta?.page ?? page })}
						/>
					</div>
				</div>
				<ProjectsTable
					emptyKind={params.status}
					error={active.isError}
					filtered={params.goal !== '' || params.tag !== ''}
					goalTitles={goalTitles}
					isLoading={active.isPending || (active.isPlaceholderData && active.isFetching && rows.length === 0)}
					onBulkAction={onBulkAction}
					onOpen={setOpened}
					onPageChange={next => void setParams({ page: next })}
					onRetry={() => void active.refetch()}
					onSelectedIdsChange={setSelectedIds}
					onSetArchived={onSetArchived}
					onSetStatus={onSetStatus}
					page={meta?.page ?? page}
					pageCount={pageCount}
					pageSize={PAGE_SIZE}
					rows={rows}
					selectable
					selectedIds={selectedIds}
					total={meta?.total ?? 0}
				/>
			</Page.Body>
			<NewProjectModal onOpenChange={setCreating} open={creating} />
			<ProjectDrawer onChange={setOpened} onClose={() => setOpened(undefined)} project={opened} />
		</Fragment>
	);
}
