"use client";

import {
  type ColumnDef,
  columnSizingFeature,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Checkbox } from "../../forms-inputs/checkbox/checkbox";
import { cn } from "../../utils/tailwind/cn";
import { Pagination } from "../pagination/pagination";

const dataTableFeatures = tableFeatures({
  columnSizingFeature,
});

/** Feature set passed to `useTable`; consumers need this to type their `columns` array as `ColumnDef<DataTableFeatures, TData>[]`. */
export type DataTableFeatures = typeof dataTableFeatures;

export interface TablePagination {
  /** Current 1-indexed page. */
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  /** Total row count across all pages. */
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}

export interface TableSelection<TData> {
  /** IDs of the currently selected rows, for controlled usage — own this state yourself (e.g. next to a `TableToolbar.BulkActionsBar`) and pass it back in. */
  readonly selectedIds: ReadonlySet<string>;
  /** Called with the full new set of selected IDs on any change — a single row, or "select/clear all" from the header checkbox. */
  readonly onSelectedIdsChange: (ids: Set<string>) => void;
  /** Derives a stable string ID from a row's data (e.g. `(row) => row.id`) — required since selection must survive re-sorting/re-fetching, which a table-internal row index can't. */
  readonly getRowId: (row: TData) => string;
  /** Rows for which this returns `false` (group headers, placeholders) show no checkbox and are skipped by "select all". @default every row is selectable */
  readonly isSelectable?: (row: TData) => boolean;
}

export interface DataTableProps<TData extends Record<string, any>> {
  readonly data: TData[];
  readonly columns: ColumnDef<DataTableFeatures, TData>[];
  /** Omit to render without a pagination bar (e.g. a short, unpaginated list). */
  readonly pagination?: TablePagination;
  /** Renders skeleton rows in place of `data`. */
  readonly isLoading?: boolean;
  /** Arbitrary content (filters, search, actions) above the pagination bar. */
  readonly toolbar?: React.ReactNode;
  /**
   * Text shown when `data` is empty. Ignored if `emptyState` is passed.
   * @default "No data available."
   */
  readonly emptyMessage?: string;
  /** Custom content shown when `data` is empty, instead of `emptyMessage`. */
  readonly emptyState?: React.ReactNode;
  /** Hides the column header row (a list-style table whose columns need no titles). It is always hidden while the table is empty, so only the empty state shows. The select-all checkbox lives in the header, so own it elsewhere when hiding it. */
  readonly hideHeader?: boolean;
  /** Extra classes on every body row (e.g. to change its hover tint or border). */
  readonly rowClassName?: string;
  /** Extra classes for one row, on top of `rowClassName` (e.g. to style a group header). */
  readonly getRowClassName?: (row: TData) => string | undefined;
  /** Extra classes on the sticky header row (e.g. to swap its opaque background for a translucent one). */
  readonly headerClassName?: string;
  /** Extra classes on every body cell (e.g. to change its padding). */
  readonly cellClassName?: string;
  /** Extra classes on the scroll container that holds the table (border, radius, background). */
  readonly containerClassName?: string;
  /** Makes rows clickable, calling back with the row's original data. */
  readonly onRowClick?: (row: TData) => void;
  /** Adds a checkbox column (with a "select all [on this page]" header checkbox) for bulk actions. Omit for a table with no bulk actions. */
  readonly selection?: TableSelection<TData>;
  /** Extra classes on the root wrapper. The root and the row-scroll region both carry `flex-1 min-h-0`, so putting this table inside a flex column with a bounded height (e.g. `Page.Body` given `flex-1 min-h-0`) makes it grow to fill the available space and scroll its own rows — under the header — instead of the whole page scrolling. Inert in a normal auto-sized parent, so this is safe to leave on by default. */
  readonly className?: string;
}

/** Placeholder rows shown while `isLoading` is true. `hasSelection` adds one extra empty cell so columns still line up with the checkbox column. */
function SkeletonRows({
  colCount,
  hasSelection,
  rowClassName,
  cellClassName,
}: {
  colCount: number;
  hasSelection: boolean;
  rowClassName?: string;
  cellClassName?: string;
}) {
  return Array.from(
    {
      length: 6,
    },
    (_, rowIdx) => (
      <tr
        className={cn("border-b border-border", rowClassName)}
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder sin id estable
        key={rowIdx}
      >
        {hasSelection && <td className={cn("px-4 py-3.5", cellClassName)} />}
        {Array.from(
          {
            length: colCount,
          },
          (_, colIdx) => (
            <td
              className={cn("px-4 py-3.5", cellClassName)}
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder sin id estable
              key={colIdx}
            >
              <div
                className="h-4 bg-muted rounded-md animate-pulse"
                style={{
                  width: `${60 + (colIdx % 3) * 15}%`,
                }}
              />
            </td>
          ),
        )}
      </tr>
    ),
  );
}

/**
 * Data table with column sizing (TanStack Table's standalone-features API),
 * skeleton loading, and offset pagination. Pass `selection` to add a
 * checkbox column for bulk actions — pair it with a
 * `TableToolbar.BulkActionsBar` (rendered via the `toolbar` prop) to show
 * "N selected" plus your own bulk actions (delete, export, ...) once
 * `selection.selectedIds` isn't empty.
 */
export function DataTable<TData extends Record<string, any>>({
  data,
  columns,
  pagination,
  isLoading = false,
  toolbar,
  emptyMessage = "No data available.",
  emptyState,
  onRowClick,
  selection,
  hideHeader = false,
  rowClassName,
  getRowClassName,
  cellClassName,
  containerClassName,
  headerClassName,
  className,
}: DataTableProps<TData>) {
  "use no memo";
  const table = useTable({
    columns,
    data,
    features: dataTableFeatures,
  });

  const rows = table.getRowModel().rows;
  const isEmpty = !isLoading && rows.length === 0;
  const colCount = columns.length + (selection ? 1 : 0);

  const isSelectable = (row: TData) => selection?.isSelectable?.(row) ?? true;
  const pageRowIds = selection
    ? rows
        .filter((row) => isSelectable(row.original))
        .map((row) => selection.getRowId(row.original))
    : [];
  const selectedOnPageCount = selection
    ? pageRowIds.filter((id) => selection.selectedIds.has(id)).length
    : 0;
  const allOnPageSelected = selection
    ? pageRowIds.length > 0 && selectedOnPageCount === pageRowIds.length
    : false;
  const someOnPageSelected = selectedOnPageCount > 0 && !allOnPageSelected;

  const toggleRow = (id: string, checked: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    selection.onSelectedIdsChange(next);
  };

  const toggleAllOnPage = (checked: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    for (const id of pageRowIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    selection.onSelectedIdsChange(next);
  };

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4",
        className,
      )}
    >
      {toolbar && (
        <div className="flex shrink-0 items-center gap-3 flex-wrap">
          {toolbar}
        </div>
      )}

      <div
        className={cn(
          "w-full min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-background",
          // Nothing to scroll: the empty state takes the whole width, however wide the columns are.
          isEmpty && "overflow-x-hidden",
          containerClassName,
        )}
      >
        <table
          className={cn("w-full text-sm", isEmpty && "h-full")}
          style={{
            minWidth: isEmpty ? undefined : table.getTotalSize(),
          }}
        >
          <thead className={hideHeader || isEmpty ? "sr-only" : undefined}>
            {table.getHeaderGroups().map((hg) => (
              <tr
                // `bg-background` (opaque), not `bg-muted` — `--muted` is a
                // translucent hover tint by design, which let scrolled rows
                // show through this sticky header.
                className={cn(
                  "sticky top-0 z-10 border-b border-border bg-background",
                  headerClassName,
                )}
                key={hg.id}
              >
                {selection && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={someOnPageSelected}
                      onCheckedChange={toggleAllOnPage}
                    >
                      <Checkbox.Toggle />
                      <Checkbox.Label className="sr-only">
                        Select all rows on this page
                      </Checkbox.Label>
                    </Checkbox>
                  </th>
                )}
                {hg.headers.map((header) => (
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold font-primary text-muted-foreground tracking-wide whitespace-nowrap"
                    key={header.id}
                    style={{
                      minWidth: header.column.getSize(),
                    }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading && (
              <SkeletonRows
                cellClassName={cellClassName}
                colCount={columns.length}
                hasSelection={!!selection}
                rowClassName={rowClassName}
              />
            )}
            {isEmpty && (
              <tr className="h-full">
                <td
                  className="align-middle"
                  colSpan={colCount}
                >
                  {emptyState ?? (
                    <p className="px-4 py-14 text-center text-sm font-primary text-muted-foreground">
                      {emptyMessage}
                    </p>
                  )}
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row) => {
                const rowId = selection?.getRowId(row.original);
                return (
                  <tr
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-muted transition-colors duration-150",
                      onRowClick && "cursor-pointer",
                      rowClassName,
                      getRowClassName?.(row.original),
                    )}
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {selection && rowId !== undefined && !isSelectable(row.original) && (
                      <td className={cn("px-4 py-3", cellClassName)} />
                    )}
                    {selection && rowId !== undefined && isSelectable(row.original) && (
                      <td
                        className={cn("px-4 py-3", cellClassName)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={selection.selectedIds.has(rowId)}
                          onCheckedChange={(checked) =>
                            toggleRow(rowId, checked)
                          }
                        >
                          <Checkbox.Toggle />
                          <Checkbox.Label className="sr-only">
                            Select row
                          </Checkbox.Label>
                        </Checkbox>
                      </td>
                    )}
                    {row.getAllCells().map((cell) => (
                      <td
                        className={cn(
                          "px-4 py-3 text-foreground font-primary",
                          cellClassName,
                        )}
                        key={cell.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {pagination && (
        <Pagination
          className="shrink-0"
          onPageChange={pagination.onPageChange}
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          total={pagination.total}
        />
      )}
    </div>
  );
}
