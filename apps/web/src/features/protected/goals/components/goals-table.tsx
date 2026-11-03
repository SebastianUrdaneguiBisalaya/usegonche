import type { ColumnDef } from '@tanstack/react-table';
import { Archive, CircleAlert, FolderKanban, MoreHorizontal, RotateCcw, Target } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import type { DataTableFeatures } from '~/components/ui/data-display/data-table/data-table';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { BulkBar, type BulkBarAction } from '../../shared/bulk-bar';
import { plainText } from '../../shared/display';
import { ListEmpty, ListTable } from '../../shared/list-table';
import { formatRelative } from '../../shared/relative-time';
import { StatusMenu } from '../../shared/status-pill';
import { listStyles } from '../../shared/styles';
import type { BulkAction, Goal } from '../api';
import { displayStatus, goalIcon, isOverdue, statusLook, todayDateOnly } from '../display';
import { type GoalStatus, type GoalTab, goalStatuses } from '../search-params';

/** A row of the table. */
export interface GoalRow {
	goal?: Goal;
	id: string;
	title: string;
	updatedAt: string;
}

interface GoalsTableProps {
	/** Which empty state to show: the tab being listed. */
	emptyKind: GoalTab;
	/** Fills the table with a retry action when the request failed. */
	error: boolean;
	/** The due filter is on, so an empty list may be the filter's doing. */
	filtered: boolean;
	isLoading: boolean;
	onBulkAction: (action: BulkAction) => void;
	onOpen: (goal: Goal) => void;
	onPageChange: (page: number) => void;
	onRetry: () => void;
	onSelectedIdsChange: (ids: Set<string>) => void;
	onSetArchived: (goal: Goal, archived: boolean) => void;
	onSetStatus: (goal: Goal, status: GoalStatus) => void;
	page: number;
	pageCount: number;
	pageSize: number;
	rows: GoalRow[];
	selectable: boolean;
	selectedIds: ReadonlySet<string>;
	total: number;
}

const stopRow = (event: { stopPropagation: () => void }) => event.stopPropagation();

const setLabel = { achieved: 'goals.actions.setAchieved', active: 'goals.actions.setActive' } as const;

/** The goals list: icon and title, description, target date (flagged when overdue), progress, projects, status and last change, paginated and filling the available height. */
export function GoalsTable({
	emptyKind,
	error,
	filtered,
	isLoading,
	onBulkAction,
	onOpen,
	onPageChange,
	onRetry,
	onSelectedIdsChange,
	onSetArchived,
	onSetStatus,
	page,
	pageCount,
	pageSize,
	rows,
	selectable,
	selectedIds,
	total,
}: GoalsTableProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }), [locale]);

	const columns = useMemo<ColumnDef<DataTableFeatures, GoalRow>[]>(
		() => [
			{
				cell: ({ row }) => {
					const { goal, id, title } = row.original;
					if (!goal) return <Typography.Span className='text-sm font-medium'>{title}</Typography.Span>;
					return (
						<Layout.HStack gap='md'>
							<span aria-hidden className='flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.06] text-muted-foreground'>
								<Icon icon={goalIcon(id)} size='md' />
							</span>
							<Typography.Span className='line-clamp-2 min-w-0 text-sm font-medium' title={title}>
								{title}
							</Typography.Span>
						</Layout.HStack>
					);
				},
				header: t('goals.columns.title'),
				id: 'title',
				size: 280,
			},
			{
				cell: ({ row }) => {
					const text = plainText(row.original.goal?.description ?? null);
					return (
						<Typography.Span className='line-clamp-2 max-w-[20rem] text-sm text-muted-foreground' title={text}>
							{text}
						</Typography.Span>
					);
				},
				header: t('goals.columns.description'),
				id: 'description',
				size: 260,
			},
			{
				cell: ({ row }) => {
					const goal = row.original.goal;
					if (!goal?.targetDate) return goal ? <Typography.Span className='text-sm text-muted-foreground'>—</Typography.Span> : null;
					const label = dateFormat.format(new Date(goal.targetDate));
					if (!isOverdue(goal, todayDateOnly())) return <Typography.Span className='whitespace-nowrap text-sm'>{label}</Typography.Span>;
					return (
						<span className='flex items-center gap-2 whitespace-nowrap text-sm font-medium text-destructive' title={t('goals.cell.overdue')}>
							<Icon aria-hidden icon={CircleAlert} size='sm' />
							{label}
							<span className='sr-only'>{t('goals.cell.overdue')}</span>
						</span>
					);
				},
				header: t('goals.columns.targetDate'),
				id: 'targetDate',
				size: 160,
			},
			{
				cell: ({ row }) => {
					const goal = row.original.goal;
					if (!goal) return null;
					const { done, total: counting } = goal.taskCounts;
					const percent = counting === 0 ? 0 : Math.round((done / counting) * 100);
					const label = counting === 0 ? t('goals.cell.noTasks') : t('goals.cell.progress', { done, total: counting });
					return (
						<Layout.Stack className='w-40' gap='xs'>
							<span className='text-xs tabular-nums'>{percent}%</span>
							<Progress aria-label={label} title={label} value={percent}>
								<Progress.Indicator className='h-1.5' />
							</Progress>
						</Layout.Stack>
					);
				},
				header: t('goals.columns.progress'),
				id: 'progress',
				size: 180,
			},
			{
				cell: ({ row }) => {
					const goal = row.original.goal;
					if (!goal) return null;
					return (
						<span
							className='flex items-center gap-2 text-sm text-muted-foreground tabular-nums'
							title={t(goal.projectCount === 1 ? 'goals.cell.projects_one' : 'goals.cell.projects_other', { count: goal.projectCount })}
						>
							<Icon aria-hidden icon={FolderKanban} size='sm' />
							{goal.projectCount}
						</span>
					);
				},
				header: t('goals.columns.projects'),
				id: 'projects',
				size: 100,
			},
			{
				cell: ({ row }) => {
					const goal = row.original.goal;
					if (!goal) return null;
					const status = displayStatus(goal);
					return (
						<div className='w-fit' onClick={stopRow} onKeyDown={stopRow}>
							<StatusMenu
								ariaLabel={t('goals.status.change')}
								current={statusLook(status, t(`goals.status.${status}`))}
								onChange={next => onSetStatus(goal, next)}
								options={goalStatuses.map(value => ({ ...statusLook(value, t(`goals.status.${value}`)), value }))}
								readOnly={status === 'archived'}
								selected={goal.status}
							/>
						</div>
					);
				},
				header: t('goals.columns.status'),
				id: 'status',
				size: 150,
			},
			{
				cell: ({ row }) => <Typography.Span className='whitespace-nowrap text-sm text-muted-foreground'>{formatRelative(row.original.updatedAt, locale)}</Typography.Span>,
				header: t('goals.columns.updated'),
				id: 'updated',
				size: 110,
			},
			{
				cell: ({ row }) => {
					const goal = row.original.goal;
					if (!goal) return null;
					return (
						<div className='flex justify-end' onClick={stopRow} onKeyDown={stopRow}>
							<Dropdown>
								<Dropdown.Trigger>
									<Button aria-label={t('goals.actions.rowMenu')} className={listStyles.iconButton} size='icon' title={t('goals.actions.rowMenu')} variant='ghost'>
										<Button.Icon icon={MoreHorizontal} />
									</Button>
								</Dropdown.Trigger>
								<Dropdown.Content align='end'>
									<Dropdown.Item onSelect={() => onOpen(goal)}>
										<Target aria-hidden className='size-4' />
										{t('goals.actions.open')}
									</Dropdown.Item>
									<Dropdown.Item onSelect={() => onSetArchived(goal, !goal.archivedAt)}>
										{goal.archivedAt ? <RotateCcw aria-hidden className='size-4' /> : <Archive aria-hidden className='size-4' />}
										{goal.archivedAt ? t('goals.actions.restore') : t('goals.actions.archive')}
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
		[dateFormat, locale, onOpen, onSetArchived, onSetStatus, t]
	);

	const archivedTab = emptyKind === 'archived';
	const actions: BulkBarAction[] = archivedTab ? [] : goalStatuses.map(status => ({ ...statusLook(status, t(setLabel[status])), key: status, onClick: () => onBulkAction({ status }) }));
	const hasSelection = selectable && selectedIds.size > 0;

	return (
		<ListTable
			columns={columns}
			empty={
				<ListEmpty
					description={filtered ? t('goals.empty.filtered') : t(`goals.empty.${emptyKind}.description`)}
					error={error}
					errorTitle={t('goals.error.title')}
					icon={Target}
					onRetry={onRetry}
					retryLabel={t('goals.error.retry')}
					title={t(`goals.empty.${emptyKind}.title`)}
				/>
			}
			footer={
				hasSelection ? (
					<BulkBar
						actions={actions}
						clearLabel={t('goals.actions.clearSelection')}
						countLabel={t('goals.selection.count', { count: selectedIds.size })}
						moreLabel={t('goals.actions.more')}
						onClear={() => onSelectedIdsChange(new Set())}
						trailing={{
							icon: archivedTab ? RotateCcw : Archive,
							key: 'archive',
							label: archivedTab ? t('goals.actions.restore') : t('goals.actions.archive'),
							onClick: () => onBulkAction({ archived: !archivedTab }),
						}}
					/>
				) : (
					<Typography.Span className='text-sm text-muted-foreground tabular-nums'>
						{isLoading ? '' : t(total === 1 ? 'goals.selection.total_one' : 'goals.selection.total_other', { count: total })}
					</Typography.Span>
				)
			}
			isLoading={isLoading}
			onRowClick={row => row.goal && onOpen(row.goal)}
			pagination={{ onPageChange, page, pageCount, pageSize, total }}
			paginationClassName={hasSelection ? 'ml-auto' : 'sm:absolute sm:left-1/2 sm:-translate-x-1/2'}
			rows={rows}
			selection={selectable ? { getRowId: row => row.id, onSelectedIdsChange, selectedIds } : undefined}
		/>
	);
}
