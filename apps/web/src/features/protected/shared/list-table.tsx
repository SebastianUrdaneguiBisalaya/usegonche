import type { ColumnDef } from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { DataTable, type DataTableFeatures, type TablePagination, type TableSelection } from '~/components/ui/data-display/data-table/data-table';
import { Pagination } from '~/components/ui/data-display/pagination/pagination';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { listStyles } from './styles';

interface ListEmptyProps {
	description?: string;
	/** Fills the table with a retry action when the request failed. */
	error: boolean;
	errorTitle: string;
	icon: LucideIcon;
	onRetry: () => void;
	retryLabel: string;
	title?: string;
}

/** What a list shows when it has no rows: the retry action after an error, or an icon with a title and a hint. */
export function ListEmpty({ description, error, errorTitle, icon, onRetry, retryLabel, title }: ListEmptyProps) {
	if (error) {
		return (
			<Layout.Stack align='center' className='px-4 py-16 text-center' gap='sm'>
				<Typography.Span className='text-sm text-muted-foreground'>{errorTitle}</Typography.Span>
				<Button onClick={onRetry} variant='secondary'>
					<Button.Text>{retryLabel}</Button.Text>
				</Button>
			</Layout.Stack>
		);
	}
	return (
		<Layout.Stack align='center' className='px-4 py-16 text-center' gap='sm'>
			<Icon aria-hidden className='text-muted-foreground' icon={icon} size='xl' />
			{title && <Typography.Span className='text-sm font-medium'>{title}</Typography.Span>}
			{description && <Typography.Span className={title ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>{description}</Typography.Span>}
		</Layout.Stack>
	);
}

// biome-ignore lint/suspicious/noExplicitAny: same bound as `DataTable`, which interface-typed rows satisfy
interface ListTableProps<TData extends Record<string, any>> {
	cellClassName?: string;
	columns: ColumnDef<DataTableFeatures, TData>[];
	/** Shown when there are no rows. */
	empty: React.ReactNode;
	/** Left side of the footer: the selection actions, or the count. */
	footer: React.ReactNode;
	isLoading: boolean;
	onRowClick?: (row: TData) => void;
	pagination: TablePagination;
	/** Classes of the pagination, to align it (right by default, `mx-auto` to center it). */
	paginationClassName?: string;
	rows: TData[];
	selection?: TableSelection<TData>;
}

/** The glass card of a list page: the full-height table with its own scroll, and a footer with the count or selection actions next to the pagination. */
// biome-ignore lint/suspicious/noExplicitAny: same bound as `DataTable`
export function ListTable<TData extends Record<string, any>>({
	cellClassName = 'px-5 py-3',
	columns,
	empty,
	footer,
	isLoading,
	onRowClick,
	pagination,
	paginationClassName = 'ml-auto',
	rows,
	selection,
}: ListTableProps<TData>) {
	return (
		<div className={`${listStyles.card} flex min-h-64 min-h-0 flex-1 flex-col overflow-hidden`}>
			<DataTable
				cellClassName={cellClassName}
				className='min-h-0'
				columns={columns}
				containerClassName='rounded-none border-0 bg-transparent'
				data={rows}
				emptyState={empty}
				headerClassName='bg-transparent backdrop-blur'
				isLoading={isLoading}
				onRowClick={onRowClick}
				rowClassName='border-border/60'
				selection={selection}
			/>
			<div className='relative flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3'>
				{footer}
				<Pagination
					className={paginationClassName}
					onPageChange={pagination.onPageChange}
					page={pagination.page}
					pageCount={pagination.pageCount}
					pageSize={pagination.pageSize}
					showEdges={false}
					showSummary={false}
					total={pagination.total}
				/>
			</div>
		</div>
	);
}
