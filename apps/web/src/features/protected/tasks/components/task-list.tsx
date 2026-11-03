import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, ListChecks, MoreHorizontal, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import type { DataTableFeatures } from '~/components/ui/data-display/data-table/data-table';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useTranslate } from '~/hooks/use-translate';
import { ListEmpty, ListTable } from '../../shared/list-table';
import { listStyles } from '../../shared/styles';
import { TagChip } from '../../shared/tag-chip';
import type { BulkChanges, Task } from '../api';
import { statusColor, statusIcon, taskIcon } from '../display';
import { groupTasks } from '../grouping';
import type { TaskGroup, TaskPriority, TaskStatus } from '../search-params';
import { TaskBulkBar } from './task-bulk-bar';
import { BlockedTag, DueDate, PriorityMenu, TaskStatusMenu, taskDay } from './task-pills';

/** A row of the table: a task, a subtask under its parent, a group header, or a placeholder while the subtasks load. */
export interface TaskRow {
	count?: number;
	id: string;
	kind: 'group' | 'loading' | 'subtask' | 'task';
	label?: string;
	task?: Task;
}

interface TaskListProps {
	error: boolean;
	expanded: ReadonlySet<string>;
	filtered: boolean;
	goalTitles: ReadonlyMap<string, string>;
	group: TaskGroup;
	isLoading: boolean;
	onBulkApply: (changes: BulkChanges) => void;
	onDelete: (task: Task) => void;
	onOpen: (task: Task) => void;
	onPageChange: (page: number) => void;
	onRetry: () => void;
	onSelectedIdsChange: (ids: Set<string>) => void;
	onSetDue: (task: Task, dateOnly: string | null) => void;
	onSetPriority: (task: Task, priority: TaskPriority) => void;
	onSetStatus: (task: Task, status: TaskStatus) => void;
	onToggleExpanded: (id: string) => void;
	page: number;
	pageCount: number;
	pageSize: number;
	pending: boolean;
	projectTitles: ReadonlyMap<string, string>;
	selectable: boolean;
	selectedIds: ReadonlySet<string>;
	/** Subtasks of the expanded parents; `undefined` while they load. */
	subtasks: ReadonlyMap<string, Task[] | undefined>;
	tasks: Task[];
	total: number;
}

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/** The rows of the page: grouped (when asked) tasks, each followed by its subtasks when expanded. */
function buildRows(props: Pick<TaskListProps, 'expanded' | 'goalTitles' | 'group' | 'projectTitles' | 'subtasks' | 'tasks'>, groupLabel: (key: string) => string): TaskRow[] {
	const { expanded, goalTitles, group, projectTitles, subtasks, tasks } = props;
	const rows: TaskRow[] = [];
	const titles = group === 'goal' ? goalTitles : projectTitles;
	for (const bucket of groupTasks(tasks, group, titles)) {
		if (group !== 'none') rows.push({ count: bucket.tasks.length, id: `group:${bucket.key}`, kind: 'group', label: groupLabel(bucket.key) });
		for (const task of bucket.tasks) {
			rows.push({ id: task.id, kind: 'task', task });
			if (!expanded.has(task.id)) continue;
			const children = subtasks.get(task.id);
			if (!children) rows.push({ id: `loading:${task.id}`, kind: 'loading' });
			else for (const child of children) rows.push({ id: child.id, kind: 'subtask', task: child });
		}
	}
	return rows;
}

/** The list: tasks (optionally grouped) with foldable subtasks, inline status, priority and date, and bulk actions on the selection. */
export function TaskList(props: TaskListProps) {
	const {
		error,
		expanded,
		filtered,
		group,
		isLoading,
		onBulkApply,
		onDelete,
		onOpen,
		onPageChange,
		onRetry,
		onSelectedIdsChange,
		onSetDue,
		onSetPriority,
		onSetStatus,
		onToggleExpanded,
		page,
		pageCount,
		pageSize,
		pending,
		projectTitles,
		selectable,
		selectedIds,
		total,
	} = props;
	const t = useTranslate();

	const { goalTitles, subtasks, tasks } = props;
	const rows = useMemo(() => {
		const groupLabel = (key: string): string => {
			if (group === 'project') return key === 'none' ? t('tasks.group.noProject') : (projectTitles.get(key) ?? '');
			if (group === 'goal') return key === 'none' ? t('tasks.group.noGoal') : (goalTitles.get(key) ?? '');
			if (group === 'priority') return t(`tasks.priority.${key as TaskPriority}`);
			return t(`tasks.group.due.${key as 'overdue' | 'today' | 'week' | 'later' | 'none'}`);
		};
		return buildRows({ expanded, goalTitles, group, projectTitles, subtasks, tasks }, groupLabel);
	}, [expanded, goalTitles, group, projectTitles, subtasks, tasks, t]);

	const columns = useMemo<ColumnDef<DataTableFeatures, TaskRow>[]>(
		() => [
			{
				cell: ({ row }) => {
					const { count, kind, label, task } = row.original;
					if (kind === 'group') {
						return (
							<span className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
								{label}
								<span className='rounded-full bg-muted px-2 py-0.5 text-[0.7rem] tabular-nums normal-case'>{count}</span>
							</span>
						);
					}
					if (kind === 'loading' || !task) return <div aria-hidden className='ml-10 h-4 w-40 animate-pulse rounded-md bg-muted' />;
					const { done, total: counting } = task.progress;
					const percent = counting === 0 ? 0 : Math.round((done / counting) * 100);
					const finished = task.status === 'done' || task.status === 'cancelled';
					return (
						<Layout.HStack className={kind === 'subtask' ? 'pl-9' : ''} gap='sm'>
							{kind === 'task' && counting > 0 ? (
								<Button
									aria-expanded={expanded.has(task.id)}
									aria-label={expanded.has(task.id) ? t('tasks.list.collapse') : t('tasks.list.expand')}
									className='size-7 shrink-0 rounded-full p-0 text-muted-foreground'
									onClick={event => {
										stop(event);
										onToggleExpanded(task.id);
									}}
									size='icon'
									variant='ghost'
								>
									<ChevronRight aria-hidden className={`size-4 transition-transform ${expanded.has(task.id) ? 'rotate-90' : ''}`} />
								</Button>
							) : (
								<span aria-hidden className='size-7 shrink-0' />
							)}
							<span aria-hidden className='flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.06] text-muted-foreground'>
								<Icon className={task.status === 'done' ? statusColor.done : ''} icon={task.status === 'done' ? statusIcon.done : taskIcon(task.id)} size='sm' />
							</span>
							<Layout.Stack className='min-w-0' gap='xs'>
								<Layout.HStack gap='sm'>
									<Typography.Span className={`truncate text-sm font-medium ${finished ? 'text-muted-foreground line-through' : ''}`} title={task.title}>
										{task.title}
									</Typography.Span>
									{task.blocked && <BlockedTag openBlockers={task.openBlockers} />}
								</Layout.HStack>
								{kind === 'task' && counting > 0 && (
									<Progress
										aria-label={t('tasks.card.subtasks', { done, total: counting })}
										className='w-36'
										title={t('tasks.card.subtasks', { done, total: counting })}
										value={percent}
									>
										<Progress.Indicator className='h-1' />
										<Progress.Label className='w-9 text-right text-[0.7rem]' />
									</Progress>
								)}
							</Layout.Stack>
						</Layout.HStack>
					);
				},
				header: t('tasks.columns.title'),
				id: 'title',
				size: 340,
			},
			{
				cell: ({ row }) => {
					const task = row.original.task;
					const title = task?.projectId ? projectTitles.get(task.projectId) : undefined;
					return <Typography.Span className='block max-w-44 truncate text-sm text-muted-foreground'>{title ?? ''}</Typography.Span>;
				},
				header: t('tasks.columns.project'),
				id: 'project',
				size: 170,
			},
			{
				cell: ({ row }) => {
					const task = row.original.task;
					if (!task) return null;
					return (
						<div className='w-fit' onClick={stop} onKeyDown={stop}>
							<DueDate onChange={date => onSetDue(task, date)} status={task.status} value={taskDay(task.dueDate)} />
						</div>
					);
				},
				header: t('tasks.columns.due'),
				id: 'due',
				size: 130,
			},
			{
				cell: ({ row }) => {
					const task = row.original.task;
					if (!task) return null;
					return (
						<div className='w-fit' onClick={stop} onKeyDown={stop}>
							<PriorityMenu onChange={priority => onSetPriority(task, priority)} priority={task.priority} />
						</div>
					);
				},
				header: t('tasks.columns.priority'),
				id: 'priority',
				size: 130,
			},
			{
				cell: ({ row }) => {
					const task = row.original.task;
					if (!task) return null;
					return (
						<div className='w-fit' onClick={stop} onKeyDown={stop}>
							<TaskStatusMenu onChange={status => onSetStatus(task, status)} status={task.status} />
						</div>
					);
				},
				header: t('tasks.columns.status'),
				id: 'status',
				size: 150,
			},
			{
				cell: ({ row }) => (
					<Layout.HStack gap='xs' wrap>
						{(row.original.task?.tags ?? []).map(tag => (
							<TagChip color={tag.color} key={tag.id} name={tag.name} />
						))}
					</Layout.HStack>
				),
				header: t('tasks.columns.tags'),
				id: 'tags',
				size: 180,
			},
			{
				cell: ({ row }) => {
					const task = row.original.task;
					if (!task) return null;
					return (
						<div className='flex justify-end' onClick={stop} onKeyDown={stop}>
							<Dropdown>
								<Dropdown.Trigger>
									<Button aria-label={t('tasks.actions.rowMenu')} className={listStyles.iconButton} size='icon' title={t('tasks.actions.rowMenu')} variant='ghost'>
										<Button.Icon icon={MoreHorizontal} />
									</Button>
								</Dropdown.Trigger>
								<Dropdown.Content align='end'>
									<Dropdown.Item onSelect={() => onOpen(task)}>
										<ListChecks aria-hidden className='size-4' />
										{t('tasks.actions.open')}
									</Dropdown.Item>
									<Dropdown.Item onSelect={() => onDelete(task)}>
										<Trash2 aria-hidden className='size-4' />
										{t('tasks.actions.delete')}
									</Dropdown.Item>
								</Dropdown.Content>
							</Dropdown>
						</div>
					);
				},
				header: '',
				id: 'actions',
				size: 64,
			},
		],
		[expanded, onDelete, onOpen, onSetDue, onSetPriority, onSetStatus, onToggleExpanded, projectTitles, t]
	);

	const hasSelection = selectable && selectedIds.size > 0;
	const projects = useMemo(() => [...projectTitles.entries()].map(([id, title]) => ({ id, title })), [projectTitles]);

	return (
		<ListTable
			columns={columns}
			empty={
				<ListEmpty
					description={filtered ? t('tasks.empty.filtered') : t('tasks.empty.description')}
					error={error}
					errorTitle={t('tasks.error.title')}
					icon={ListChecks}
					onRetry={onRetry}
					retryLabel={t('tasks.error.retry')}
					title={filtered ? undefined : t('tasks.empty.title')}
				/>
			}
			footer={
				hasSelection ? (
					<TaskBulkBar count={selectedIds.size} onApply={onBulkApply} onClear={() => onSelectedIdsChange(new Set())} pending={pending} projects={projects} />
				) : (
					<Typography.Span className='text-sm text-muted-foreground tabular-nums'>
						{isLoading ? '' : t(total === 1 ? 'tasks.selection.total_one' : 'tasks.selection.total_other', { count: total })}
					</Typography.Span>
				)
			}
			getRowClassName={row => (row.kind === 'group' ? 'bg-foreground/[0.03] hover:bg-foreground/[0.03]' : undefined)}
			isLoading={isLoading}
			onRowClick={row => row.task && onOpen(row.task)}
			pagination={{ onPageChange, page, pageCount, pageSize, total }}
			rows={rows}
			selection={selectable ? { getRowId: row => row.id, isSelectable: row => row.kind === 'task', onSelectedIdsChange, selectedIds } : undefined}
		/>
	);
}
