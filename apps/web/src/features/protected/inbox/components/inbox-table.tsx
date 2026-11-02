import type { ColumnDef } from '@tanstack/react-table';
import { Archive, Inbox, RefreshCw, RotateCcw, SearchX, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { DataTable, type DataTableFeatures } from '~/components/ui/data-display/data-table/data-table';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelative } from '../../shared/relative-time';
import { listStyles } from '../../shared/styles';
import type { ConvertTarget, SettableStatus } from '../api';
import type { InboxStatus } from '../search-params';

/** A row of the table: an inbox item, or a search hit (read-only: it has no source, status or actions). */
export interface InboxRow {
	at: string;
	content: string;
	id: string;
	source?: 'braindump' | 'quick';
	status?: InboxStatus;
}

interface InboxTableProps {
	/** Which empty state to show: the status being listed, or `search` / `range`. */
	emptyKind: InboxStatus | 'search';
	/** Fills the table with a retry action when the request failed. */
	error: boolean;
	isLoading: boolean;
	onConvert: (row: InboxRow, target: ConvertTarget) => void;
	onPageChange: (page: number) => void;
	onRetry: () => void;
	onSelectedIdsChange: (ids: Set<string>) => void;
	onSetStatus: (row: InboxRow, status: SettableStatus) => void;
	page: number;
	pageCount: number;
	pageSize: number;
	rangeActive: boolean;
	rows: InboxRow[];
	selectable: boolean;
	selectedIds: ReadonlySet<string>;
	total: number;
}

const iconButton = `${listStyles.iconButton}`;

/** The inbox list: one row per item with its source, relative time and the actions of its status, paginated and filling the available height. */
export function InboxTable({
	emptyKind,
	error,
	isLoading,
	onConvert,
	onPageChange,
	onRetry,
	onSelectedIdsChange,
	onSetStatus,
	page,
	pageCount,
	pageSize,
	rangeActive,
	rows,
	selectable,
	selectedIds,
	total,
}: InboxTableProps) {
	const t = useTranslate();
	const { locale } = useLanguage();

	const columns = useMemo<ColumnDef<DataTableFeatures, InboxRow>[]>(
		() => [
			{
				cell: ({ row }) => {
					const item = row.original;
					return (
						<Layout.HStack gap='md'>
							<Typography.Span className='min-w-0 truncate text-sm' title={item.content}>
								{item.content}
							</Typography.Span>
							{item.source && (
								<Pill className='shrink-0 text-xs'>
									<Pill.Text>{t(`inbox.source.${item.source}`)}</Pill.Text>
								</Pill>
							)}
						</Layout.HStack>
					);
				},
				header: t('inbox.title'),
				id: 'content',
				size: 420,
			},
			{
				cell: ({ row }) => <Typography.Span className='whitespace-nowrap text-xs text-muted-foreground'>{formatRelative(row.original.at, locale)}</Typography.Span>,
				header: '',
				id: 'time',
				size: 100,
			},
			{
				cell: ({ row }) => {
					const item = row.original;
					if (!item.status || item.status === 'converted') return null;
					const status = item.status;
					return (
						<Layout.HStack className='justify-end' gap='xs'>
							{status === 'pending' && (
								<Dropdown>
									<Dropdown.Trigger>
										<Button aria-label={t('inbox.actions.convert')} className={iconButton} size='icon' title={t('inbox.actions.convert')} variant='ghost'>
											<Button.Icon icon={RefreshCw} />
										</Button>
									</Dropdown.Trigger>
									<Dropdown.Content align='end'>
										<Dropdown.Item onSelect={() => onConvert(item, 'task')}>{t('inbox.actions.toTask')}</Dropdown.Item>
										<Dropdown.Item onSelect={() => onConvert(item, 'project')}>{t('inbox.actions.toProject')}</Dropdown.Item>
										<Dropdown.Item onSelect={() => onConvert(item, 'note')}>{t('inbox.actions.toNote')}</Dropdown.Item>
									</Dropdown.Content>
								</Dropdown>
							)}
							{status === 'pending' && (
								<Button
									aria-label={t('inbox.actions.archive')}
									className={iconButton}
									onClick={() => onSetStatus(item, 'archived')}
									size='icon'
									title={t('inbox.actions.archive')}
									variant='ghost'
								>
									<Button.Icon icon={Archive} />
								</Button>
							)}
							{status !== 'pending' && (
								<Button
									aria-label={t('inbox.actions.restore')}
									className={iconButton}
									onClick={() => onSetStatus(item, 'pending')}
									size='icon'
									title={t('inbox.actions.restore')}
									variant='ghost'
								>
									<Button.Icon icon={RotateCcw} />
								</Button>
							)}
							{status !== 'discarded' && (
								<Button
									aria-label={t('inbox.actions.discard')}
									className={iconButton}
									onClick={() => onSetStatus(item, 'discarded')}
									size='icon'
									title={t('inbox.actions.discard')}
									variant='ghost'
								>
									<Button.Icon icon={Trash2} />
								</Button>
							)}
						</Layout.HStack>
					);
				},
				header: '',
				id: 'actions',
				size: 160,
			},
		],
		[locale, onConvert, onSetStatus, t]
	);

	const empty = error ? (
		<Layout.Stack align='center' className='px-4 py-16 text-center' gap='sm'>
			<Typography.Span className='text-sm text-muted-foreground'>{t('inbox.error.title')}</Typography.Span>
			<Button onClick={onRetry} variant='secondary'>
				<Button.Text>{t('inbox.error.retry')}</Button.Text>
			</Button>
		</Layout.Stack>
	) : (
		<Layout.Stack align='center' className='px-4 py-16 text-center' gap='sm'>
			<Icon aria-hidden className='text-muted-foreground' icon={emptyKind === 'search' ? SearchX : Inbox} size='xl' />
			{emptyKind === 'search' ? (
				<Typography.Span className='text-sm text-muted-foreground'>{t('inbox.search.empty')}</Typography.Span>
			) : (
				<>
					<Typography.Span className='text-sm font-medium'>{t(`inbox.empty.${emptyKind}.title`)}</Typography.Span>
					<Typography.Span className='text-xs text-muted-foreground'>{rangeActive ? t('inbox.empty.range') : t(`inbox.empty.${emptyKind}.description`)}</Typography.Span>
				</>
			)}
		</Layout.Stack>
	);

	return (
		<DataTable
			cellClassName='px-5 py-3.5'
			className='min-h-64'
			columns={columns}
			containerClassName={`${listStyles.card} bg-transparent`}
			data={rows}
			emptyState={empty}
			hideHeader
			isLoading={isLoading}
			pagination={{ onPageChange, page, pageCount, pageSize, total }}
			rowClassName='border-border/60'
			selection={
				selectable
					? {
							getRowId: row => row.id,
							onSelectedIdsChange,
							selectedIds,
						}
					: undefined
			}
		/>
	);
}
