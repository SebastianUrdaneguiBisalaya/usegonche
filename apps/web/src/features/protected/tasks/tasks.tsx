import { useQueries } from '@tanstack/react-query';
import { useHotkeys } from '@usehotkeys/react';
import { ArrowDownUp, KanbanSquare, Layers, List, Plus, Trash2 } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Tabs } from '~/components/ui/data-display/tabs/tabs';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Page } from '~/components/ui/layout/page/page';
import { ConfirmDialog } from '~/components/ui/overlays-feedback/confirm-dialog/confirm-dialog';
import { useTranslate } from '~/hooks/use-translate';
import { api } from '~/lib/api';
import { getApiErrorMessage, unwrap } from '~/lib/api-error';
import { ListSearch } from '../shared/list-search';
import { OptionSelect } from '../shared/option-select';
import { PageSelect } from '../shared/page-select';
import { PAGE_SIZE } from '../shared/paged';
import { useProjectOptions } from '../shared/projects';
import { listStyles } from '../shared/styles';
import { useTagOptions } from '../shared/tags';
import { BOARD_PAGE_SIZE, type BulkChanges, type Task, useBulkUpdate, useDeleteTask, useGoalOptions, useTasks, useTasksSearch, useUpdateTask } from './api';
import { NewTaskModal } from './components/new-task-modal';
import { NextTask } from './components/next-task';
import { TaskBoard } from './components/task-board';
import { TaskDrawer } from './components/task-drawer';
import { DueFilter, GoalFilter, ProjectFilter, TagFilter, TaskChips } from './components/task-filters';
import { TaskList } from './components/task-list';
import { TaskQuickAdd } from './components/task-quick-add';
import { type TaskGroup, type TaskPriority, type TaskSort, type TaskStatus, taskGroups, taskParsers, taskSorts } from './search-params';

const emptyIds: ReadonlySet<string> = new Set();

export default function TasksRoute() {
	const t = useTranslate();
	const [params, setParams] = useQueryStates(taskParsers, { clearOnDefault: true });
	const page = Math.max(1, params.page);
	const searching = params.q.length > 0;
	const view = params.view;
	const queryParams = useMemo(
		() => ({ blocked: params.blocked, due: params.due, goal: params.goal, page, project: params.project, sort: params.sort, status: params.status, tag: params.tag }),
		[page, params.blocked, params.due, params.goal, params.project, params.sort, params.status, params.tag]
	);

	const list = useTasks(view, queryParams, !searching);
	const search = useTasksSearch(params.q, page);
	const active = searching ? search : list;
	const counts = list.data?.meta.counts;
	const tasks = list.data?.data ?? [];
	const projects = useProjectOptions();
	const goals = useGoalOptions();
	const tags = useTagOptions();

	const projectTitles = useMemo(() => new Map((projects.data ?? []).map(project => [project.id, project.title])), [projects.data]);
	const goalTitles = useMemo(() => new Map((goals.data ?? []).map(goal => [goal.id, goal.title])), [goals.data]);
	const projectOptions = useMemo(() => (projects.data ?? []).map(project => ({ id: project.id, name: project.title })), [projects.data]);
	const goalOptions = useMemo(() => (goals.data ?? []).map(goal => ({ id: goal.id, name: goal.title })), [goals.data]);
	const tagOptions = useMemo(() => (tags.data ?? []).map(tag => ({ id: tag.id, name: tag.name })), [tags.data]);
	const projectList = useMemo(() => (projects.data ?? []).map(project => ({ id: project.id, title: project.title })), [projects.data]);

	const meta = active.data?.meta;
	const pageCount = meta?.pageCount ?? 1;
	const filtered = params.goal !== '' || params.project !== '' || params.tag !== '' || params.due !== 'any' || params.blocked;

	// Selection (list only): it belongs to one page of one view.
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(emptyIds);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the view changes.
	useEffect(() => setSelectedIds(emptyIds), [page, view, params.status, params.goal, params.project, params.tag, params.due, params.blocked, params.q]);

	// Subtasks of the expanded parents (each its own query, so a change refreshes them with the rest).
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(emptyIds);
	const expandedIds = useMemo(() => [...expanded], [expanded]);
	const subtaskQueries = useQueries({
		queries: expandedIds.map(parentId => ({
			queryFn: () => unwrap(api.tasks.$get({ query: { order: 'asc' as const, pageSize: String(BOARD_PAGE_SIZE), parentId, sort: 'createdAt' as const } })),
			queryKey: ['tasks', 'subtasks', parentId],
		})),
	});
	const subtasks = useMemo(() => new Map<string, Task[] | undefined>(expandedIds.map((id, index) => [id, subtaskQueries[index]?.data])), [expandedIds, subtaskQueries]);
	const toggleExpanded = useCallback(
		(id: string) =>
			setExpanded(current => {
				const next = new Set(current);
				if (!next.delete(id)) next.add(id);
				return next;
			}),
		[]
	);

	const [creating, setCreating] = useState<'in_progress' | 'todo' | undefined>(undefined);
	const [openedId, setOpenedId] = useState<string | undefined>(undefined);
	const [deleting, setDeleting] = useState<Task | undefined>(undefined);
	const opened = useMemo(() => tasks.find(task => task.id === openedId), [openedId, tasks]);

	const update = useUpdateTask();
	const remove = useDeleteTask();
	const bulk = useBulkUpdate();

	const fail = useCallback((error: unknown) => toast.error(getApiErrorMessage(error)), []);

	/** Every status change (drag, inline, drawer, shortcut) goes through here, so each one can be undone from the toast. */
	const onSetStatus = useCallback(
		(task: Task, status: TaskStatus) => {
			const previous = task.status;
			if (previous === status) return;
			update.mutate(
				{ changes: { status }, id: task.id },
				{
					onError: fail,
					onSuccess: () =>
						toast.success(status === 'done' ? t('tasks.toast.completed') : t('tasks.toast.statusChanged'), {
							action: { label: t('tasks.toast.undo'), onClick: () => update.mutate({ changes: { status: previous }, id: task.id }, { onError: fail }) },
						}),
				}
			);
		},
		[fail, t, update]
	);

	const onSetPriority = useCallback((task: Task, priority: TaskPriority) => update.mutate({ changes: { priority }, id: task.id }, { onError: fail }), [fail, update]);
	const onSetDue = useCallback((task: Task, dueDate: string | null) => update.mutate({ changes: { dueDate }, id: task.id }, { onError: fail }), [fail, update]);

	const onBulkApply = useCallback(
		(changes: BulkChanges) => {
			bulk.mutate(
				{ changes, ids: [...selectedIds] },
				{
					onError: fail,
					onSuccess: items => {
						setSelectedIds(emptyIds);
						toast.success(t('tasks.toast.bulk', { count: items.length }));
					},
				}
			);
		},
		[bulk, fail, selectedIds, t]
	);

	useHotkeys('n', () => setCreating('todo'), { group: 'tasks', label: t('tasks.new') });

	const sortOptions = useMemo(() => taskSorts.map((value: TaskSort) => ({ label: t(`tasks.sort.${value}`), value })), [t]);
	const groupOptions = useMemo(() => taskGroups.map((value: TaskGroup) => ({ label: t(`tasks.groupBy.${value}`), value })), [t]);
	const rowsLoading = active.isPending || (active.isPlaceholderData && active.isFetching && (active.data?.data.length ?? 0) === 0);

	return (
		<Page.Root className='min-h-0 flex-1' size='full'>
			<Page.Header>
				<div>
					<Page.Title>{t('tasks.title')}</Page.Title>
					<Page.Description>{t('tasks.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<ListSearch
						clearLabel={t('tasks.search.clear')}
						label={t('tasks.search.label')}
						onChange={q => void setParams({ page: 1, q })}
						placeholder={t('tasks.search.placeholder')}
						value={params.q}
					/>
					<Button className={listStyles.pillTrigger} onClick={() => setCreating('todo')} variant='secondary'>
						<Button.Icon icon={Plus} />
						<Button.Text>{t('tasks.new')}</Button.Text>
					</Button>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<TaskQuickAdd projects={projectList} />
				<NextTask onOpen={setOpenedId} />
				<div className={`${listStyles.card} flex flex-col gap-3 overflow-x-auto p-3`}>
					<TaskChips
						blocked={params.blocked}
						counts={counts}
						due={params.due}
						onBlockedChange={blocked => void setParams({ blocked, page: 1, q: '' })}
						onDueChange={due => void setParams({ due, page: 1, q: '' })}
						onStatusChange={status => void setParams({ page: 1, q: '', status })}
						status={params.status}
					/>
				</div>
				<div className={`${listStyles.card} flex flex-wrap items-center justify-between gap-3 p-3`}>
					<div className='flex flex-wrap items-center gap-3'>
						<ProjectFilter onChange={project => void setParams({ page: 1, project })} options={projectOptions} value={params.project} />
						<GoalFilter onChange={goal => void setParams({ goal, page: 1 })} options={goalOptions} value={params.goal} />
						<TagFilter onChange={tag => void setParams({ page: 1, tag })} options={tagOptions} value={params.tag} />
						<DueFilter onChange={due => void setParams({ due, page: 1 })} value={params.due} />
					</div>
					<div className='flex flex-wrap items-center gap-3'>
						<OptionSelect icon={ArrowDownUp} label={t('tasks.sort.label')} onChange={sort => void setParams({ page: 1, sort })} options={sortOptions} value={params.sort} />
						{view === 'list' && <OptionSelect icon={Layers} label={t('tasks.groupBy.label')} onChange={group => void setParams({ group })} options={groupOptions} value={params.group} />}
						{view === 'list' && !searching && (
							<PageSelect
								label={t('tasks.filters.page.label')}
								onChange={next => void setParams({ page: next })}
								page={meta?.page ?? page}
								pageCount={pageCount}
								valueLabel={t('tasks.filters.page.value', { page: meta?.page ?? page })}
							/>
						)}
						<Tabs onValueChange={next => void setParams({ view: next as 'board' | 'list', page: 1 })} value={view} defaultValue={view}>
							<Tabs.List aria-label={t('tasks.views.label')} className='gap-1'>
								<Tabs.Trigger value='board'>
									<Tabs.TriggerIcon icon={KanbanSquare} />
									<Tabs.TriggerTitle>{t('tasks.views.board')}</Tabs.TriggerTitle>
								</Tabs.Trigger>
								<Tabs.Trigger value='list'>
									<Tabs.TriggerIcon icon={List} />
									<Tabs.TriggerTitle>{t('tasks.views.list')}</Tabs.TriggerTitle>
								</Tabs.Trigger>
							</Tabs.List>
						</Tabs>
					</div>
				</div>
				{searching ? (
					<SearchResults hits={search.data?.data} isError={search.isError} isLoading={search.isPending} onOpen={setOpenedId} onRetry={() => void search.refetch()} />
				) : view === 'board' ? (
					<TaskBoard
						error={list.isError}
						isLoading={rowsLoading}
						onAdd={status => setCreating(status === 'in_progress' ? 'in_progress' : 'todo')}
						onMove={onSetStatus}
						onOpen={task => setOpenedId(task.id)}
						onRetry={() => void list.refetch()}
						onSetPriority={onSetPriority}
						statuses={params.status}
						tasks={tasks}
					/>
				) : (
					<TaskList
						emptyKind='tasks'
						error={list.isError}
						expanded={expanded}
						filtered={filtered}
						goalTitles={goalTitles}
						group={params.group}
						isLoading={rowsLoading}
						onBulkApply={onBulkApply}
						onDelete={setDeleting}
						onOpen={task => setOpenedId(task.id)}
						onPageChange={next => void setParams({ page: next })}
						onRetry={() => void list.refetch()}
						onSelectedIdsChange={setSelectedIds}
						onSetDue={onSetDue}
						onSetPriority={onSetPriority}
						onSetStatus={onSetStatus}
						onToggleExpanded={toggleExpanded}
						page={meta?.page ?? page}
						pageCount={pageCount}
						pageSize={PAGE_SIZE}
						pending={bulk.isPending}
						projectTitles={projectTitles}
						selectable
						selectedIds={selectedIds}
						subtasks={subtasks}
						tasks={tasks}
						total={meta?.total ?? 0}
					/>
				)}
			</Page.Body>
			<NewTaskModal onOpenChange={open => !open && setCreating(undefined)} open={creating !== undefined} status={creating ?? 'todo'} />
			<TaskDrawer initial={opened} onClose={() => setOpenedId(undefined)} onOpenTask={setOpenedId} onSetStatus={onSetStatus} taskId={openedId} />
			<ConfirmDialog.Root
				lang={{ cancel: t('tasks.delete.cancel'), confirm: t('tasks.delete.confirm') }}
				onConfirm={async () => {
					if (!deleting) return;
					await remove.mutateAsync(deleting.id);
					toast.success(t('tasks.toast.deleted'));
					setDeleting(undefined);
				}}
				onOpenChange={open => !open && setDeleting(undefined)}
				open={deleting !== undefined}
				variant='destructive'
			>
				<ConfirmDialog.Content>
					<ConfirmDialog.Icon icon={Trash2} />
					<ConfirmDialog.Title>{t('tasks.delete.title')}</ConfirmDialog.Title>
					<ConfirmDialog.Description>{t('tasks.delete.description', { title: deleting?.title ?? '' })}</ConfirmDialog.Description>
					<ConfirmDialog.Footer>
						<ConfirmDialog.Cancel />
						<ConfirmDialog.Confirm />
					</ConfirmDialog.Footer>
				</ConfirmDialog.Content>
			</ConfirmDialog.Root>
		</Page.Root>
	);
}

interface SearchResultsProps {
	hits: { id: string; title: string }[] | undefined;
	isError: boolean;
	isLoading: boolean;
	onOpen: (id: string) => void;
	onRetry: () => void;
}

/** What `GET /search?types=task` found: titles only (the detail opens in the drawer). */
function SearchResults({ hits, isError, isLoading, onOpen, onRetry }: SearchResultsProps) {
	const t = useTranslate();
	return (
		<div className={`${listStyles.card} min-h-64 flex-1 overflow-y-auto p-3`}>
			{isLoading ? (
				<Typography.Span className='block py-10 text-center text-sm text-muted-foreground'>{t('tasks.search.loading')}</Typography.Span>
			) : isError ? (
				<div className='flex flex-col items-center gap-2 py-10'>
					<Typography.Span className='text-sm text-muted-foreground'>{t('tasks.error.title')}</Typography.Span>
					<Button onClick={onRetry} variant='secondary'>
						<Button.Text>{t('tasks.error.retry')}</Button.Text>
					</Button>
				</div>
			) : !hits || hits.length === 0 ? (
				<Typography.Span className='block py-10 text-center text-sm text-muted-foreground'>{t('tasks.search.empty')}</Typography.Span>
			) : (
				<ul className='flex flex-col'>
					{hits.map(hit => (
						<li key={hit.id}>
							<button className='w-full cursor-pointer truncate rounded-xl px-4 py-3 text-left text-sm hover:bg-foreground/[0.06]' onClick={() => onOpen(hit.id)} type='button'>
								{hit.title}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
