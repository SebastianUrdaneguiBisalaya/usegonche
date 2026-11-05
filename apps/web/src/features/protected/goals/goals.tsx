import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@usegonche/api-client';
import { ArrowDownUp, CalendarClock, Plus } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Page } from '~/components/ui/layout/page/page';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { API_BASE } from '~/lib/api';
import { OptionSelect } from '../shared/option-select';
import { PAGE_SIZE } from '../shared/paged';
import { StatusTabs } from '../shared/status-tabs';
import { listStyles } from '../shared/styles';
import { type BulkAction, type Goal, type GoalsPage, goalsKey, goalsQuery, useBulkGoalAction, useGoalList, useSetGoalArchived, useUpdateGoal } from './api';
import { GoalDrawer } from './components/goal-drawer';
import { type GoalRow, GoalsTable } from './components/goals-table';
import { NewGoalModal } from './components/new-goal-modal';
import { statusColor, statusIcon } from './display';
import { type GoalDue, type GoalSort, type GoalStatus, goalDues, goalParsers, goalSorts, goalTabs, loadGoalsParams } from './search-params';

interface LoaderData {
	data: GoalsPage;
	params: { due: string; page: number; sort: string; status: string };
}

/**
 * Loads the first page on the server from the URL's params (the request cookie is forwarded: a parent loader does not protect this one).
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData | null> {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	const params = loadGoalsParams(request);
	const res = await createClient(API_BASE, { headers: { cookie } })
		.goals.$get({ query: goalsQuery(params) })
		.catch(() => undefined);
	// The API's 401 comes from its global middleware, so it is not part of the inferred response type.
	const status: number | undefined = res?.status;
	if (status === 401) throw redirect('/auth/sign-in');
	if (!res?.ok) return null;
	return { data: (await res.json()) as GoalsPage, params };
}

const emptyIds: ReadonlySet<string> = new Set();

export default function GoalsRoute() {
	const t = useTranslate();
	const queryClient = useQueryClient();
	const loaderData = useLoaderData<typeof loader>();
	const [params, setParams] = useQueryStates(goalParsers, { clearOnDefault: true });
	const page = Math.max(1, params.page);

	// Seeds the cache with what the loader resolved, so the first render already has the page (no extra request, no skeleton).
	if (loaderData) {
		const key = goalsKey({
			due: loaderData.params.due as GoalDue,
			page: loaderData.params.page,
			sort: loaderData.params.sort as GoalSort,
			status: loaderData.params.status as typeof params.status,
		});
		if (queryClient.getQueryData(key) === undefined) queryClient.setQueryData(key, loaderData.data);
	}

	const list = useGoalList({ due: params.due, page, sort: params.sort, status: params.status });
	const active = list;
	const counts = list.data?.meta.counts;

	const rows = useMemo<GoalRow[]>(() => {
		return (list.data?.data ?? []).map(goal => ({ goal, id: goal.id, title: goal.title, updatedAt: goal.updatedAt }));
	}, [list.data]);

	const meta = active.data?.meta;
	const pageCount = meta?.pageCount ?? 1;
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(emptyIds);
	// A selection belongs to one page of one view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the view changes.
	useEffect(() => setSelectedIds(emptyIds), [page, params.status, params.due, params.sort]);

	const [creating, setCreating] = useState(false);
	const [opened, setOpened] = useState<Goal | undefined>(undefined);

	const update = useUpdateGoal();
	const setArchived = useSetGoalArchived();
	const bulk = useBulkGoalAction();

	const onSetStatus = useCallback(
		(goal: Goal, status: GoalStatus) => {
			const previous = goal.status;
			update.mutate(
				{ changes: { status }, id: goal.id },
				{
					onSuccess: () =>
						toast.success(t('goals.toast.statusChanged'), { action: { label: t('goals.toast.undo'), onClick: () => update.mutate({ changes: { status: previous }, id: goal.id }) } }),
				}
			);
		},
		[t, update]
	);

	const onSetArchived = useCallback(
		(goal: Goal, archived: boolean) => {
			setArchived.mutate(
				{ archived, id: goal.id },
				{
					onSuccess: () =>
						toast.success(archived ? t('goals.toast.archived') : t('goals.toast.restored'), {
							action: { label: t('goals.toast.undo'), onClick: () => setArchived.mutate({ archived: !archived, id: goal.id }) },
						}),
				}
			);
		},
		[setArchived, t]
	);

	const onBulkAction = useCallback(
		(action: BulkAction) => {
			// Goals already in the target state are left alone.
			const byId = new Map((list.data?.data ?? []).map(goal => [goal.id, goal]));
			const ids = [...selectedIds].filter(id => {
				const goal = byId.get(id);
				if (!goal) return true;
				return 'status' in action ? goal.status !== action.status : Boolean(goal.archivedAt) !== action.archived;
			});
			if (ids.length === 0) return setSelectedIds(emptyIds);
			bulk.mutate(
				{ action, ids },
				{
					onSuccess: count => {
						setSelectedIds(emptyIds);
						toast.success(t('goals.toast.bulk', { count }));
					},
				}
			);
		},
		[bulk, list.data, selectedIds, t]
	);

	const tabs = useMemo(
		() =>
			goalTabs.map(value => ({
				icon: statusIcon[value],
				iconClassName: `${statusColor[value]} ${value === 'active' ? 'fill-current' : ''}`,
				label: t(`goals.tabs.${value}`),
				value,
			})),
		[t]
	);
	const sortOptions = useMemo(() => goalSorts.map(value => ({ label: t(`goals.sort.${value}`), value })), [t]);
	const dueOptions = useMemo(() => goalDues.map(value => ({ label: t(`goals.filters.due.${value}`), value })), [t]);

	return (
		<Fragment>
			<Page.Header>
				<div>
					<Page.Title>{t('goals.title')}</Page.Title>
					<Page.Description>{t('goals.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<Button className={listStyles.pillTrigger} onClick={() => setCreating(true)} variant='secondary'>
						<Button.Icon icon={Plus} />
						<Button.Text>{t('goals.new')}</Button.Text>
					</Button>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<div className={cn(listStyles.card, 'flex flex-wrap items-center justify-between gap-3 p-3')}>
					<StatusTabs ariaLabel={t('goals.tabs.label')} counts={counts} onChange={status => void setParams({ page: 1, status })} tabs={tabs} value={params.status} />
					<div className='flex flex-wrap items-center gap-3'>
						<OptionSelect icon={CalendarClock} label={t('goals.filters.due.label')} onChange={(due: GoalDue) => void setParams({ due, page: 1 })} options={dueOptions} value={params.due} />
						<OptionSelect icon={ArrowDownUp} label={t('goals.sort.label')} onChange={(sort: GoalSort) => void setParams({ page: 1, sort })} options={sortOptions} value={params.sort} />
					</div>
				</div>
				<GoalsTable
					emptyKind={params.status}
					error={active.isError}
					filtered={params.due !== 'all'}
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
			<NewGoalModal onOpenChange={setCreating} open={creating} />
			<GoalDrawer goal={opened} onChange={setOpened} onClose={() => setOpened(undefined)} />
		</Fragment>
	);
}
