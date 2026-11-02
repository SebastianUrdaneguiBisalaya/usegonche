import type { ColumnDef } from '@tanstack/react-table';
import { Archive, FolderKanban, MoreHorizontal, RotateCcw, SearchX } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { DataTable, type DataTableFeatures } from '~/components/ui/data-display/data-table/data-table';
import { Pagination } from '~/components/ui/data-display/pagination/pagination';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Tag } from '~/components/ui/data-display/tag/tag';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelative } from '../../shared/relative-time';
import { listStyles } from '../../shared/styles';
import type { BulkAction, Project } from '../api';
import { displayStatus, plainText, projectIcon, tagColor } from '../display';
import { type ProjectStatus, type ProjectTab } from '../search-params';
import { BulkBar } from './bulk-bar';
import { StatusMenu } from './status-pill';

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
					return (
						<div className='w-fit' onClick={stopRow} onKeyDown={stopRow}>
							<StatusMenu onChange={status => onSetStatus(project, status)} status={displayStatus(project)} />
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

	const empty = error ? (
		<Layout.Stack align='center' className='px-4 py-16 text-center' gap='sm'>
			<Typography.Span className='text-sm text-muted-foreground'>{t('projects.error.title')}</Typography.Span>
			<Button onClick={onRetry} variant='secondary'>
				<Button.Text>{t('projects.error.retry')}</Button.Text>
			</Button>
		</Layout.Stack>
	) : (
		<Layout.Stack align='center' className='px-4 py-16 text-center' gap='sm'>
			<Icon aria-hidden className='text-muted-foreground' icon={emptyKind === 'search' ? SearchX : FolderKanban} size='xl' />
			{emptyKind === 'search' ? (
				<Typography.Span className='text-sm text-muted-foreground'>{t('projects.search.empty')}</Typography.Span>
			) : (
				<>
					<Typography.Span className='text-sm font-medium'>{t(`projects.empty.${emptyKind}.title`)}</Typography.Span>
					<Typography.Span className='text-xs text-muted-foreground'>{filtered ? t('projects.empty.filtered') : t(`projects.empty.${emptyKind}.description`)}</Typography.Span>
				</>
			)}
		</Layout.Stack>
	);

	const hasSelection = selectable && selectedIds.size > 0;

	return (
		<div className={`${listStyles.card} flex min-h-64 min-h-0 flex-1 flex-col overflow-hidden`}>
			<DataTable
				cellClassName='px-5 py-3'
				className='min-h-0'
				columns={columns}
				containerClassName='rounded-none border-0 bg-transparent'
				data={rows}
				emptyState={empty}
				headerClassName='bg-transparent backdrop-blur'
				isLoading={isLoading}
				onRowClick={row => row.project && onOpen(row.project)}
				rowClassName='border-border/60'
				selection={selectable ? { getRowId: row => row.id, onSelectedIdsChange, selectedIds } : undefined}
			/>
			<div className='flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3'>
				{hasSelection ? (
					<BulkBar archived={emptyKind === 'archived'} count={selectedIds.size} disabled={false} onAction={onBulkAction} onClear={() => onSelectedIdsChange(new Set())} />
				) : (
					<Typography.Span className='text-sm text-muted-foreground tabular-nums'>
						{isLoading ? '' : t(total === 1 ? 'projects.selection.total_one' : 'projects.selection.total_other', { count: total })}
					</Typography.Span>
				)}
				<Pagination className='ml-auto' onPageChange={onPageChange} page={page} pageCount={pageCount} pageSize={pageSize} showEdges={false} showSummary={false} total={total} />
			</div>
		</div>
	);
}
