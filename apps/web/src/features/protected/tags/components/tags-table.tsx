import type { ColumnDef } from '@tanstack/react-table';
import { FileText, FolderKanban, Pencil, SearchX, SquareCheck, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/actions-controls/button/button';
import type { DataTableFeatures } from '~/components/ui/data-display/data-table/data-table';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { BulkBar } from '../../shared/bulk-bar';
import { ListEmpty, ListTable } from '../../shared/list-table';
import { listStyles } from '../../shared/styles';
import { tagDot } from '../../shared/tags';
import type { Tag } from '../api';

interface TagsTableProps {
	/** Fills the table with a retry action when the request failed. */
	error: boolean;
	isLoading: boolean;
	onDelete: (tags: Tag[]) => void;
	onPageChange: (page: number) => void;
	onRename: (tag: Tag) => void;
	onRetry: () => void;
	onSelectedIdsChange: (ids: Set<string>) => void;
	page: number;
	pageCount: number;
	pageSize: number;
	rows: Tag[];
	/** The search is on, so an empty list may be the search's doing. */
	searching: boolean;
	selectedIds: ReadonlySet<string>;
	total: number;
}

const chip = 'inline-flex items-center gap-2 rounded-full bg-foreground/[0.06] px-3 py-1.5 text-sm tabular-nums';

/** The tags list: colored name, where it is used (tasks, projects, notes), dates and the rename / delete actions, paginated and filling the available height. */
export function TagsTable({ error, isLoading, onDelete, onPageChange, onRename, onRetry, onSelectedIdsChange, page, pageCount, pageSize, rows, searching, selectedIds, total }: TagsTableProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);

	const columns = useMemo<ColumnDef<DataTableFeatures, Tag>[]>(
		() => [
			{
				cell: ({ row }) => (
					<span className='flex min-w-0 items-center gap-3'>
						<span aria-hidden className={`size-3 shrink-0 rounded-full ${tagDot(row.original.name)}`} />
						<Typography.Span className='truncate text-sm font-medium' title={row.original.name}>
							{row.original.name}
						</Typography.Span>
					</span>
				),
				header: t('tags.columns.tag'),
				id: 'name',
				size: 240,
			},
			{
				cell: ({ row }) => {
					const { notes, projects, tasks } = row.original.usage;
					const label = (key: 'notes' | 'projects' | 'tasks', count: number) => t(count === 1 ? `tags.usage.${key}_one` : `tags.usage.${key}_other`, { count });
					return (
						<span className='flex flex-wrap items-center gap-2'>
							<span className={chip} title={label('tasks', tasks)}>
								<Icon aria-hidden icon={SquareCheck} size='sm' />
								{tasks}
								<span className='sr-only'>{label('tasks', tasks)}</span>
							</span>
							{projects > 0 ? (
								<Link
									aria-label={`${label('projects', projects)}. ${t('tags.usage.openProjects')}`}
									className={`${chip} transition-colors hover:bg-foreground/[0.12]`}
									onClick={event => event.stopPropagation()}
									title={t('tags.usage.openProjects')}
									to={`/projects?tag=${row.original.id}`}
								>
									<Icon aria-hidden icon={FolderKanban} size='sm' />
									{projects}
								</Link>
							) : (
								<span className={chip} title={label('projects', projects)}>
									<Icon aria-hidden icon={FolderKanban} size='sm' />
									{projects}
									<span className='sr-only'>{label('projects', projects)}</span>
								</span>
							)}
							<span className={chip} title={label('notes', notes)}>
								<Icon aria-hidden icon={FileText} size='sm' />
								{notes}
								<span className='sr-only'>{label('notes', notes)}</span>
							</span>
						</span>
					);
				},
				header: t('tags.columns.usedIn'),
				id: 'usage',
				size: 320,
			},
			{
				cell: ({ row }) => <Typography.Span className='whitespace-nowrap text-sm'>{dateFormat.format(new Date(row.original.createdAt))}</Typography.Span>,
				header: t('tags.columns.created'),
				id: 'created',
				size: 150,
			},
			{
				cell: ({ row }) => <Typography.Span className='whitespace-nowrap text-sm'>{dateFormat.format(new Date(row.original.updatedAt))}</Typography.Span>,
				header: t('tags.columns.updated'),
				id: 'updated',
				size: 150,
			},
			{
				cell: ({ row }) => (
					<div className='flex justify-end gap-1'>
						<Button
							aria-label={t('tags.actions.rename')}
							className={listStyles.iconButton}
							onClick={() => onRename(row.original)}
							size='icon'
							title={t('tags.actions.rename')}
							variant='ghost'
						>
							<Button.Icon icon={Pencil} />
						</Button>
						<Button
							aria-label={t('tags.actions.delete')}
							className={listStyles.iconButton}
							onClick={() => onDelete([row.original])}
							size='icon'
							title={t('tags.actions.delete')}
							variant='ghost'
						>
							<Button.Icon icon={Trash2} />
						</Button>
					</div>
				),
				header: '',
				id: 'actions',
				size: 110,
			},
		],
		[dateFormat, onDelete, onRename, t]
	);

	const selected = rows.filter(tag => selectedIds.has(tag.id));

	return (
		<ListTable
			columns={columns}
			empty={
				<ListEmpty
					description={searching ? t('tags.search.empty') : t('tags.empty.description')}
					error={error}
					errorTitle={t('tags.error.title')}
					icon={searching ? SearchX : TagIcon}
					onRetry={onRetry}
					retryLabel={t('tags.error.retry')}
					title={searching ? undefined : t('tags.empty.title')}
				/>
			}
			footer={
				selected.length > 0 ? (
					<BulkBar
						actions={[]}
						clearLabel={t('tags.actions.clearSelection')}
						countLabel={t('tags.selection.count', { count: selected.length })}
						moreLabel={t('tags.actions.more')}
						onClear={() => onSelectedIdsChange(new Set())}
						trailing={{ icon: Trash2, key: 'delete', label: t('tags.actions.deleteSelected'), onClick: () => onDelete(selected) }}
					/>
				) : (
					<Typography.Span className='text-sm text-muted-foreground tabular-nums'>
						{isLoading ? '' : t(total === 1 ? 'tags.selection.total_one' : 'tags.selection.total_other', { count: total })}
					</Typography.Span>
				)
			}
			isLoading={isLoading}
			pagination={{ onPageChange, page, pageCount, pageSize, total }}
			rows={rows}
			selection={{ getRowId: row => row.id, onSelectedIdsChange, selectedIds }}
		/>
	);
}
