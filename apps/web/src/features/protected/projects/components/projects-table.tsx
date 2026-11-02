import type { ColumnDef } from '@tanstack/react-table';
import { Archive, FolderKanban, MoreHorizontal, RotateCcw, SearchX } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import type { DataTableFeatures } from '~/components/ui/data-display/data-table/data-table';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Tag } from '~/components/ui/data-display/tag/tag';
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
import type { BulkAction, Project } from '../api';
import { displayStatus, projectIcon, statusDot, tagColor } from '../display';
import { type ProjectStatus, type ProjectTab, projectStatuses } from '../search-params';

/** A row of the table: a project, or a search hit (read-only: it only knows its title and date). */
export interface ProjectRow {
	id: string;
	project?: Project;
	title: string;
	updatedAt: string;
}

interface ProjectsTableProps {
	/** Which empty state to show: the tab being listed, or `search`. */
	emptyKind: ProjectTab | 'search';
	/** Fills the table with a retry action when the request failed. */
	error: boolean;
	/** The goal filter or the tag filter is on, so an empty list may be the filter's doing. */
	filtered: boolean;
	/** Goal titles by id, for the goal column. */
	goalTitles: ReadonlyMap<string, string>;
	isLoading: boolean;
	onBulkAction: (action: BulkAction) => void;
	onOpen: (project: Project) => void;
	onPageChange: (page: number) => void;
	onRetry: () => void;
	onSelectedIdsChange: (ids: Set<string>) => void;
	onSetArchived: (project: Project, archived: boolean) => void;
	onSetStatus: (project: Project, status: ProjectStatus) => void;
	page: number;
	pageCount: number;
	pageSize: number;
	rows: ProjectRow[];
	selectable: boolean;
	selectedIds: ReadonlySet<string>;
	total: number;
}

const stopRow = (event: { stopPropagation: () => void }) => event.stopPropagation();

const setLabel = { active: 'projects.actions.setActive', completed: 'projects.actions.setCompleted', on_hold: 'projects.actions.setOnHold' } as const;

/** The projects list: icon, title and progress, description, goal, colored tags, status and last change, paginated and filling the available height. */
export function ProjectsTable({
	emptyKind,
	error,
	filtered,
	goalTitles,
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
}: ProjectsTableProps) {
	const t = useTranslate();
	const { locale } = useLanguage();

	const columns = useMemo<ColumnDef<DataTableFeatures, ProjectRow>[]>(
		() => [
			{
				cell: ({ row }) => {
					const { id, project, title } = row.original;
					if (!project) return <Typography.Span className='truncate text-sm font-medium'>{title}</Typography.Span>;
					const { done, total: counting } = project.taskCounts;
					const percent = counting === 0 ? 0 : Math.round((done / counting) * 100);
					return (
						<Layout.HStack gap='md'>
							<span aria-hidden className='flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.06] text-muted-foreground'>
								<Icon icon={projectIcon(id)} size='md' />
							</span>
							<Layout.Stack className='min-w-0' gap='xs'>
								<Typography.Span className='truncate text-sm font-medium' title={title}>
									{title}
								</Typography.Span>
								<Progress
									aria-label={counting === 0 ? t('projects.cell.noTasks') : t('projects.cell.progress', { done, total: counting })}
									className='w-36'
									title={counting === 0 ? t('projects.cell.noTasks') : t('projects.cell.progress', { done, total: counting })}
									value={percent}
								>
									<Progress.Indicator className='h-1' />
									<Progress.Label className='w-9 text-right text-[0.7rem]' />
								</Progress>
							</Layout.Stack>
						</Layout.HStack>
					);
				},
				header: t('projects.columns.title'),
				id: 'title',
				size: 300,
			},
			{
				cell: ({ row }) => {
					const text = plainText(row.original.project?.description ?? null);
					return (
						<Typography.Span className='block max-w-[22rem] truncate text-sm text-muted-foreground' title={text}>
							{text}
						</Typography.Span>
					);
				},
				header: t('projects.columns.description'),
				id: 'description',
				size: 260,
			},
			{
				cell: ({ row }) => {
					const goalId = row.original.project?.goalId;
					const title = goalId ? goalTitles.get(goalId) : undefined;
					return <Typography.Span className='block max-w-48 truncate text-sm text-muted-foreground'>{title ?? ''}</Typography.Span>;
				},
				header: t('projects.columns.goal'),
				id: 'goal',
				size: 170,
			},
			{
				cell: ({ row }) => (
					<Layout.HStack gap='xs' wrap>
						{(row.original.project?.tags ?? []).map(tag => (
							<Tag color={tagColor(tag.name)} key={tag.id} size='sm'>
								<Tag.Text>{tag.name}</Tag.Text>
							</Tag>
						))}
					</Layout.HStack>
				),
				header: t('projects.columns.tags'),
				id: 'tags',
				size: 200,
			},
			{
				cell: ({ row }) => {
					const project = row.original.project;
					if (!project) return null;
					const status = displayStatus(project);
					return (
						<div className='w-fit' onClick={stopRow} onKeyDown={stopRow}>
							<StatusMenu
								ariaLabel={t('projects.status.change')}
								current={{ dotClassName: statusDot[status], label: t(`projects.status.${status}`) }}
								onChange={next => onSetStatus(project, next)}
								options={projectStatuses.map(value => ({ dotClassName: statusDot[value], label: t(`projects.status.${value}`), value }))}
								readOnly={status === 'archived'}
								selected={project.status}
							/>
						</div>
					);
				},
				header: t('projects.columns.status'),
				id: 'status',
				size: 150,
			},
			{
				cell: ({ row }) => <Typography.Span className='whitespace-nowrap text-sm text-muted-foreground'>{formatRelative(row.original.updatedAt, locale)}</Typography.Span>,
				header: t('projects.columns.updated'),
				id: 'updated',
				size: 110,
			},
			{
				cell: ({ row }) => {
					const project = row.original.project;
					if (!project) return null;
					return (
						<div className='flex justify-end' onClick={stopRow} onKeyDown={stopRow}>
							<Dropdown>
								<Dropdown.Trigger>
									<Button aria-label={t('projects.actions.rowMenu')} className={listStyles.iconButton} size='icon' title={t('projects.actions.rowMenu')} variant='ghost'>
										<Button.Icon icon={MoreHorizontal} />
									</Button>
								</Dropdown.Trigger>
								<Dropdown.Content align='end'>
									<Dropdown.Item onSelect={() => onOpen(project)}>
										<FolderKanban aria-hidden className='size-4' />
										{t('projects.actions.open')}
									</Dropdown.Item>
									<Dropdown.Item onSelect={() => onSetArchived(project, !project.archivedAt)}>
										{project.archivedAt ? <RotateCcw aria-hidden className='size-4' /> : <Archive aria-hidden className='size-4' />}
										{project.archivedAt ? t('projects.actions.restore') : t('projects.actions.archive')}
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
		[goalTitles, locale, onOpen, onSetArchived, onSetStatus, t]
	);

	const archivedTab = emptyKind === 'archived';
	const actions: BulkBarAction[] = archivedTab
		? []
		: projectStatuses.map(status => ({ dotClassName: statusDot[status], key: status, label: t(setLabel[status]), onClick: () => onBulkAction({ status }) }));
	const hasSelection = selectable && selectedIds.size > 0;

	return (
		<ListTable
			columns={columns}
			empty={
				<ListEmpty
					description={emptyKind === 'search' ? t('projects.search.empty') : filtered ? t('projects.empty.filtered') : t(`projects.empty.${emptyKind}.description`)}
					error={error}
					errorTitle={t('projects.error.title')}
					icon={emptyKind === 'search' ? SearchX : FolderKanban}
					onRetry={onRetry}
					retryLabel={t('projects.error.retry')}
					title={emptyKind === 'search' ? undefined : t(`projects.empty.${emptyKind}.title`)}
				/>
			}
			footer={
				hasSelection ? (
					<BulkBar
						actions={actions}
						clearLabel={t('projects.actions.clearSelection')}
						countLabel={t('projects.selection.count', { count: selectedIds.size })}
						moreLabel={t('projects.actions.more')}
						onClear={() => onSelectedIdsChange(new Set())}
						trailing={{
							icon: archivedTab ? RotateCcw : Archive,
							key: 'archive',
							label: archivedTab ? t('projects.actions.restore') : t('projects.actions.archive'),
							onClick: () => onBulkAction({ archived: !archivedTab }),
						}}
					/>
				) : (
					<Typography.Span className='text-sm text-muted-foreground tabular-nums'>
						{isLoading ? '' : t(total === 1 ? 'projects.selection.total_one' : 'projects.selection.total_other', { count: total })}
					</Typography.Span>
				)
			}
			isLoading={isLoading}
			onRowClick={row => row.project && onOpen(row.project)}
			pagination={{ onPageChange, page, pageCount, pageSize, total }}
			rows={rows}
			selection={selectable ? { getRowId: row => row.id, onSelectedIdsChange, selectedIds } : undefined}
		/>
	);
}
