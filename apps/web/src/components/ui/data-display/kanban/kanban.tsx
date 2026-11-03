"use client";

import { CalendarDays, X } from "lucide-react";
import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { DatePicker } from "../../forms-inputs/date-picker/date-picker";
import { Icon } from "../../foundations/icon/icon";
import { cn } from "../../utils/tailwind/cn";
import { Avatar } from "../avatar/avatar";
import {
  filterItems,
  groupByColumn,
  isDateFilterEmpty,
  type KanbanAssignee,
  type KanbanDateFilter,
  type KanbanDateRange,
  type KanbanItem,
  type KanbanTone,
  moveItem,
} from "./kanban-items";

export type {
  KanbanAssignee,
  KanbanDateFilter,
  KanbanDateRange,
  KanbanItem,
  KanbanTone,
};

/** Mode of the optional date filter, mirroring `DatePicker`'s own `mode`. */
export type KanbanDateFilterMode = "single" | "range";

/** Where a dragged or grabbed card would land: a column and an index in its visible cards. */
interface KanbanDropTarget {
  columnId: string;
  index: number;
}

/** Details of a completed move, handed to `onItemMove`. */
export interface KanbanMoveDetail {
  /** Id of the card that moved. */
  itemId: string;
  /** Column the card came from. */
  fromColumnId: string;
  /** Column the card landed in. */
  toColumnId: string;
  /** Index among the target column's visible cards. */
  toIndex: number;
}

/** Every string the board renders on its own, so the component can be localised without a fork. */
export interface KanbanLang {
  /** Visible label above the date filter. */
  dateFilter: string;
  /** Placeholder inside the date filter's trigger while nothing is selected. */
  dateFilterPlaceholder: string;
  /** Accessible name of the button that clears the date filter. */
  clearDateFilter: string;
  /** Summary line next to the board title. Receives the visible and total card counts. */
  summary: (visible: number, total: number) => string;
  /** Text shown inside a column that has no cards. */
  emptyColumn: string;
  /** Role description announced for a card, e.g. "draggable card". */
  cardRoleDescription: string;
  /** Instructions announced when a card takes focus. */
  cardInstructions: string;
  /** Announced when a card is picked up with the keyboard. */
  grabbed: (title: string) => string;
  /** Announced on every keyboard move while a card is held. */
  moved: (
    title: string,
    column: string,
    position: number,
    total: number,
  ) => string;
  /** Announced when a held card is dropped. */
  dropped: (title: string, column: string) => string;
  /** Announced when a keyboard move is cancelled with Escape. */
  cancelled: (title: string) => string;
}

/** English defaults for `KanbanLang`. */
export const defaultKanbanLang: KanbanLang = {
  cancelled: (title) => `Move cancelled. ${title} is back in its position.`,
  cardInstructions:
    "Press Space to pick up the card, the arrow keys to move it, Space to drop it and Escape to cancel.",
  cardRoleDescription: "Draggable card",
  clearDateFilter: "Clear the date filter",
  dateFilter: "Filter by date",
  dateFilterPlaceholder: "All dates",
  dropped: (title, column) => `${title} moved to ${column}.`,
  emptyColumn: "No cards.",
  grabbed: (title) => `${title} picked up.`,
  moved: (title, column, position, total) =>
    `${title} in ${column}, position ${position} of ${total}.`,
  summary: (visible, total) =>
    visible === total
      ? `${total} ${total === 1 ? "card" : "cards"}`
      : `${visible} of ${total} cards`,
};

/** Default day format on a card: `Jan 15`, the shortest form that stays unambiguous. */
function defaultDateFormat(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

/** First letters of the first two words of a name, for the avatar fallback. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

interface KanbanContextValue {
  items: readonly KanbanItem[];
  visibleByColumn: Map<string, KanbanItem[]>;
  boardRef: React.RefObject<HTMLDivElement | null>;
  getColumnIds: () => string[];
  columnTitles: Map<string, string>;
  registerColumnTitle: (id: string, title: string) => void;
  draggingId: string | null;
  grabbedId: string | null;
  dropTarget: KanbanDropTarget | null;
  setDropTarget: (target: KanbanDropTarget | null) => void;
  startDrag: (itemId: string) => void;
  endDrag: () => void;
  dropAt: (target: KanbanDropTarget) => void;
  handleCardKeyDown: (event: React.KeyboardEvent, item: KanbanItem) => void;
  registerCard: (itemId: string, element: HTMLElement | null) => void;
  lang: KanbanLang;
  dateFormat: (date: Date) => string;
  instructionsId: string;
  readOnly: boolean;
  filterMode: KanbanDateFilterMode | null;
  filter: KanbanDateFilter | null;
  setFilter: (filter: KanbanDateFilter) => void;
  filterActive: boolean;
  visibleCount: number;
  totalCount: number;
}

const KanbanContext = createContext<KanbanContextValue | null>(null);

function useKanbanContext(): KanbanContextValue {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error("Kanban.* must be used inside <Kanban.Root>.");
  }
  return context;
}

const ColumnContext = createContext<string | null>(null);

// ─── Root ────────────────────────────────────────────────────────────────────

export interface KanbanRootProps {
  /** `Kanban.Toolbar` and `Kanban.Board`, in the order they should render. */
  children: ReactNode;
  /** Cards, for controlled usage. Pair it with `onItemsChange`. */
  items?: readonly KanbanItem[];
  /** Initial cards, for uncontrolled usage. */
  defaultItems?: readonly KanbanItem[];
  /** Called with the full, reordered card list after every move. */
  onItemsChange?: (items: KanbanItem[]) => void;
  /** Called with the details of a move, for logging or persisting a single change. */
  onItemMove?: (detail: KanbanMoveDetail) => void;
  /**
   * Turns on the date filter and picks its shape. Leave it out and the board never filters: the
   * toolbar's `Kanban.DateFilter` renders nothing and cards without dates behave like any other.
   */
  dateFilter?: KanbanDateFilterMode;
  /**
   * Keeps cards that carry no `date` visible while a date filter is active. Turn it off only when
   * an undated card is genuinely out of scope for the selected days.
   * @default true
   */
  showUndated?: boolean;
  /** Called whenever the date filter's selection changes. */
  onDateFilterChange?: (filter: KanbanDateFilter) => void;
  /** Disables dragging and the keyboard move, leaving the board read-only. @default false */
  readOnly?: boolean;
  /**
   * Texts rendered by this component. Merges over English defaults.
   * @default defaultKanbanLang
   */
  lang?: Partial<KanbanLang>;
  /** Formats a card's date. @default `Jan 15` (en-US, short month) */
  dateFormat?: (date: Date) => string;
  className?: string;
}

/**
 * Root of the compound Kanban board. Owns the cards, the drag and keyboard move, and the optional
 * date filter, and hands all of it to the pieces below through context.
 * @example
 * ```tsx
 * <Kanban.Root dateFilter="range" defaultItems={items} onItemsChange={setItems}>
 *   <Kanban.Toolbar>
 *     <Kanban.Title>Entregas</Kanban.Title>
 *     <Kanban.DateFilter />
 *   </Kanban.Toolbar>
 *   <Kanban.Board>
 *     <Kanban.Column id="todo" title="Por hacer" />
 *     <Kanban.Column id="doing" title="En curso" />
 *     <Kanban.Column id="done" title="Listo" />
 *   </Kanban.Board>
 * </Kanban.Root>
 * ```
 */
function Root({
  children,
  items: controlledItems,
  defaultItems,
  onItemsChange,
  onItemMove,
  dateFilter,
  showUndated = true,
  onDateFilterChange,
  readOnly = false,
  lang: langOverrides,
  dateFormat = defaultDateFormat,
  className,
}: KanbanRootProps) {
  const instructionsId = useId();
  const isControlled = controlledItems !== undefined;

  const [internalItems, setInternalItems] = useState<KanbanItem[]>(() => [
    ...(defaultItems ?? []),
  ]);
  const items = isControlled ? controlledItems : internalItems;

  const [columnTitles, setColumnTitles] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanDropTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const [filter, setFilterState] = useState<KanbanDateFilter>(() =>
    dateFilter === "range"
      ? {
          mode: "range",
          value: {
            from: null,
            to: null,
          },
        }
      : {
          mode: "single",
          value: null,
        },
  );

  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  /** Snapshot taken when a card is grabbed, so Escape can put the board back exactly as it was. */
  const grabSnapshot = useRef<KanbanItem[] | null>(null);

  const lang = useMemo<KanbanLang>(
    () => ({
      ...defaultKanbanLang,
      ...langOverrides,
    }),
    [
      langOverrides,
    ],
  );

  // `dateFilter` can change at runtime (a board that starts undated and gains a filter), so the
  // stored selection is only honoured while it still matches the requested mode, and is rebuilt
  // in the new mode as soon as it doesn't.
  useEffect(() => {
    if (!dateFilter || filter.mode === dateFilter) return;
    setFilterState(
      dateFilter === "range"
        ? {
            mode: "range",
            value: {
              from: null,
              to: null,
            },
          }
        : {
            mode: "single",
            value: null,
          },
    );
  }, [
    dateFilter,
    filter.mode,
  ]);

  const activeFilter = dateFilter && filter.mode === dateFilter ? filter : null;
  const filterActive = !isDateFilterEmpty(activeFilter);

  const visibleItems = useMemo(
    () => filterItems(items, activeFilter, showUndated),
    [
      items,
      activeFilter,
      showUndated,
    ],
  );
  const visibleByColumn = useMemo(
    () => groupByColumn(visibleItems),
    [
      visibleItems,
    ],
  );

  // Column order is read from the DOM rather than from `Kanban.Board`'s children, so columns keep
  // working when a consumer wraps or maps them inside another component — which is the normal way
  // a board gets built — instead of silently losing their left/right order.
  const getColumnIds = useCallback(
    () =>
      Array.from(
        boardRef.current?.querySelectorAll<HTMLElement>(
          "[data-kanban-column]",
        ) ?? [],
      )
        .map((element) => element.dataset.kanbanColumn)
        .filter((id): id is string => Boolean(id)),
    [],
  );

  const registerColumnTitle = useCallback((id: string, title: string) => {
    setColumnTitles((previous) => {
      if (previous.get(id) === title) return previous;
      const next = new Map(previous);
      next.set(id, title);
      return next;
    });
  }, []);

  const registerCard = useCallback(
    (itemId: string, element: HTMLElement | null) => {
      if (element) cardRefs.current.set(itemId, element);
      else cardRefs.current.delete(itemId);
    },
    [],
  );

  const commit = useCallback(
    (next: KanbanItem[]) => {
      if (!isControlled) setInternalItems(next);
      onItemsChange?.(next);
    },
    [
      isControlled,
      onItemsChange,
    ],
  );

  const applyMove = useCallback(
    (itemId: string, toColumnId: string, toIndex: number) => {
      const current = items.find((item) => item.id === itemId);
      if (!current) return null;

      const visibleIds = (visibleByColumn.get(toColumnId) ?? [])
        .filter((item) => item.id !== itemId)
        .map((item) => item.id);
      const clampedIndex = Math.max(0, Math.min(toIndex, visibleIds.length));

      const next = moveItem(
        items,
        itemId,
        toColumnId,
        clampedIndex,
        visibleIds,
      );
      commit(next);
      onItemMove?.({
        fromColumnId: current.columnId,
        itemId,
        toColumnId,
        toIndex: clampedIndex,
      });

      return {
        index: clampedIndex,
        total: visibleIds.length + 1,
      };
    },
    [
      items,
      visibleByColumn,
      commit,
      onItemMove,
    ],
  );

  const startDrag = useCallback((itemId: string) => {
    setDraggingId(itemId);
  }, []);

  const endDrag = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const dropAt = useCallback(
    (target: KanbanDropTarget) => {
      if (draggingId) applyMove(draggingId, target.columnId, target.index);
      setDraggingId(null);
      setDropTarget(null);
    },
    [
      draggingId,
      applyMove,
    ],
  );

  /** Moves a held card one step along an axis and announces where it landed. */
  const moveGrabbed = useCallback(
    (item: KanbanItem, axis: "column" | "row", delta: number) => {
      const columnItems = visibleByColumn.get(item.columnId) ?? [];
      const currentIndex = columnItems.findIndex(
        (candidate) => candidate.id === item.id,
      );

      let toColumnId = item.columnId;
      let toIndex = currentIndex === -1 ? 0 : currentIndex;

      if (axis === "column") {
        const columnIds = getColumnIds();
        const columnIndex = columnIds.indexOf(item.columnId);
        const nextColumn = columnIds[columnIndex + delta];
        if (!nextColumn) return;
        toColumnId = nextColumn;
        toIndex = Math.min(
          toIndex,
          (visibleByColumn.get(nextColumn) ?? []).length,
        );
      } else {
        toIndex += delta;
        if (toIndex < 0 || toIndex > columnItems.length - 1) return;
      }

      const result = applyMove(item.id, toColumnId, toIndex);
      if (!result) return;

      setAnnouncement(
        lang.moved(
          item.title,
          columnTitles.get(toColumnId) ?? toColumnId,
          result.index + 1,
          result.total,
        ),
      );
    },
    [
      visibleByColumn,
      getColumnIds,
      applyMove,
      lang,
      columnTitles,
    ],
  );

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent, item: KanbanItem) => {
      if (readOnly) return;
      const isGrabbed = grabbedId === item.id;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (isGrabbed) {
          setGrabbedId(null);
          grabSnapshot.current = null;
          setAnnouncement(
            lang.dropped(
              item.title,
              columnTitles.get(item.columnId) ?? item.columnId,
            ),
          );
          return;
        }
        grabSnapshot.current = [
          ...items,
        ];
        setGrabbedId(item.id);
        setAnnouncement(
          `${lang.grabbed(item.title)} ${lang.moved(
            item.title,
            columnTitles.get(item.columnId) ?? item.columnId,
            (visibleByColumn.get(item.columnId) ?? []).findIndex(
              (candidate) => candidate.id === item.id,
            ) + 1,
            (visibleByColumn.get(item.columnId) ?? []).length,
          )}`,
        );
        return;
      }

      if (event.key === "Escape" && isGrabbed) {
        event.preventDefault();
        if (grabSnapshot.current) commit(grabSnapshot.current);
        grabSnapshot.current = null;
        setGrabbedId(null);
        setAnnouncement(lang.cancelled(item.title));
        return;
      }

      if (!isGrabbed) return;

      const moves: Record<
        string,
        | [
            "column" | "row",
            number,
          ]
        | undefined
      > = {
        ArrowDown: [
          "row",
          1,
        ],
        ArrowLeft: [
          "column",
          -1,
        ],
        ArrowRight: [
          "column",
          1,
        ],
        ArrowUp: [
          "row",
          -1,
        ],
      };
      const move = moves[event.key];
      if (!move) return;

      event.preventDefault();
      moveGrabbed(item, move[0], move[1]);
    },
    [
      readOnly,
      grabbedId,
      lang,
      columnTitles,
      items,
      visibleByColumn,
      commit,
      moveGrabbed,
    ],
  );

  // A card that crosses columns is unmounted and remounted by React, which drops focus on the
  // <body> mid-move. Re-focusing the held card after every commit is what keeps an arrow-key move
  // continuous for a keyboard user.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `items` is the trigger, not a read — the effect must run again after every commit, which is exactly when the card was remounted.
  useEffect(() => {
    if (!grabbedId) return;
    cardRefs.current.get(grabbedId)?.focus();
  }, [
    grabbedId,
    items,
  ]);

  const setFilter = useCallback(
    (next: KanbanDateFilter) => {
      setFilterState(next);
      onDateFilterChange?.(next);
    },
    [
      onDateFilterChange,
    ],
  );

  const contextValue = useMemo<KanbanContextValue>(
    () => ({
      boardRef,
      columnTitles,
      dateFormat,
      draggingId,
      dropAt,
      dropTarget,
      endDrag,
      filter: activeFilter,
      filterActive,
      filterMode: dateFilter ?? null,
      getColumnIds,
      grabbedId,
      handleCardKeyDown,
      instructionsId,
      items,
      lang,
      readOnly,
      registerCard,
      registerColumnTitle,
      setDropTarget,
      setFilter,
      startDrag,
      totalCount: items.length,
      visibleByColumn,
      visibleCount: visibleItems.length,
    }),
    [
      columnTitles,
      dateFormat,
      dropAt,
      dropTarget,
      draggingId,
      endDrag,
      activeFilter,
      filterActive,
      dateFilter,
      getColumnIds,
      grabbedId,
      handleCardKeyDown,
      instructionsId,
      items,
      lang,
      readOnly,
      registerCard,
      registerColumnTitle,
      setFilter,
      startDrag,
      visibleByColumn,
      visibleItems.length,
    ],
  );

  return (
    <KanbanContext.Provider value={contextValue}>
      <section
        className={cn(
          "flex w-full flex-col gap-4 font-primary text-foreground",
          className,
        )}
      >
        {children}

        <p
          className="sr-only"
          id={instructionsId}
        >
          {lang.cardInstructions}
        </p>

        <output
          aria-live="polite"
          className="sr-only"
        >
          {announcement}
        </output>
      </section>
    </KanbanContext.Provider>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

export interface KanbanToolbarProps {
  /** Toolbar contents, e.g. `Kanban.Title`, `Kanban.Summary` and `Kanban.DateFilter`. */
  children: ReactNode;
  className?: string;
}

/** Header row above the board: the title and summary on the left, the filter on the right. */
function Toolbar({ children, className }: KanbanToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface KanbanTitleProps {
  /** Name of the board. */
  children: ReactNode;
  /**
   * Heading element to render, so the board fits the page's outline.
   * @default "h2"
   */
  as?: "h1" | "h2" | "h3" | "h4";
  className?: string;
}

/** Board title, rendered as a heading. */
function Title({ as: Heading = "h2", children, className }: KanbanTitleProps) {
  return (
    <Heading className={cn("text-base font-medium leading-none", className)}>
      {children}
    </Heading>
  );
}

export interface KanbanSummaryProps {
  className?: string;
}

/** Live count of visible cards against the board's total. Reads "8 de 14 tarjetas" while filtered. */
function Summary({ className }: KanbanSummaryProps) {
  const { lang, visibleCount, totalCount } = useKanbanContext();

  return (
    <p
      className={cn(
        "font-secondary text-xs tabular-nums text-muted-foreground",
        className,
      )}
    >
      {lang.summary(visibleCount, totalCount)}
    </p>
  );
}

// ─── Date filter ─────────────────────────────────────────────────────────────

export interface KanbanDateFilterProps {
  /** Overrides the visible label above the picker. */
  label?: string;
  /** Overrides the placeholder shown while nothing is selected. */
  placeholder?: string;
  /** Earliest selectable day. */
  minDate?: Date;
  /** Latest selectable day. */
  maxDate?: Date;
  className?: string;
}

/**
 * Date filter for the board, backed by `DatePicker` in the mode `Kanban.Root` was given.
 * Renders nothing when `Kanban.Root` has no `dateFilter`, so the same toolbar markup works for a
 * board that doesn't use dates at all.
 */
function DateFilterControl({
  label,
  placeholder,
  minDate,
  maxDate,
  className,
}: KanbanDateFilterProps) {
  const { filterMode, filter, setFilter, filterActive, lang } =
    useKanbanContext();

  if (!filterMode || !filter) return null;

  return (
    <div className={cn("flex items-end gap-1", className)}>
      <div className={filterMode === "range" ? "w-64" : "w-52"}>
        {filter.mode === "single" ? (
          <DatePicker.Root
            key="single"
            maxDate={maxDate}
            minDate={minDate}
            mode="single"
            onChange={(value) =>
              setFilter({
                mode: "single",
                value,
              })
            }
            value={filter.value}
          >
            <DatePicker.Label className="mb-1.5 block text-xs font-normal text-muted-foreground">
              {label ?? lang.dateFilter}
            </DatePicker.Label>
            <DatePicker.Trigger
              placeholder={placeholder ?? lang.dateFilterPlaceholder}
            />
            <DatePicker.Content />
          </DatePicker.Root>
        ) : (
          <DatePicker.Root
            key="range"
            maxDate={maxDate}
            minDate={minDate}
            mode="range"
            onChange={(value) =>
              setFilter({
                mode: "range",
                value,
              })
            }
            value={filter.value}
          >
            <DatePicker.Label className="mb-1.5 block text-xs font-normal text-muted-foreground">
              {label ?? lang.dateFilter}
            </DatePicker.Label>
            <DatePicker.Trigger
              placeholder={placeholder ?? lang.dateFilterPlaceholder}
            />
            <DatePicker.Content />
          </DatePicker.Root>
        )}
      </div>

      {filterActive && (
        <button
          aria-label={lang.clearDateFilter}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() =>
            setFilter(
              filter.mode === "single"
                ? {
                    mode: "single",
                    value: null,
                  }
                : {
                    mode: "range",
                    value: {
                      from: null,
                      to: null,
                    },
                  },
            )
          }
          type="button"
        >
          <Icon
            icon={X}
            size="sm"
          />
        </button>
      )}
    </div>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────

export interface KanbanBoardProps {
  /** One `Kanban.Column` per column, in reading order. */
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal rail holding the columns, and the element the board reads column order from: the
 * left/right arrow keys walk a held card along the columns in the order they render here.
 */
function Board({ children, className }: KanbanBoardProps) {
  const { boardRef } = useKanbanContext();

  return (
    <div
      className={cn(
        "flex w-full items-stretch overflow-x-auto overscroll-x-contain pb-1",
        className,
      )}
      ref={boardRef}
    >
      {children}
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────────────────────

export interface KanbanColumnProps {
  /** Id matching the `columnId` of the cards that belong here. */
  id: string;
  /** Column heading. Also announced when a card moves into this column. */
  title: string;
  /** One-line explanation under the heading, for columns whose name isn't self-evident. */
  description?: string;
  /** Work-in-progress limit. The counter turns into `3/2` and goes warning-colored when exceeded. */
  limit?: number;
  /** Replaces the default card body, keeping the board's drag and keyboard behaviour. */
  renderItem?: (item: KanbanItem) => ReactNode;
  /** Footer slot under the card list, e.g. an "add card" button. */
  children?: ReactNode;
  className?: string;
}

/** A single column: its heading, its counter, and the drop zone holding its cards. */
function Column({
  id,
  title,
  description,
  limit,
  renderItem,
  children,
  className,
}: KanbanColumnProps) {
  const {
    visibleByColumn,
    dropTarget,
    setDropTarget,
    dropAt,
    draggingId,
    lang,
    registerColumnTitle,
  } = useKanbanContext();
  const headingId = useId();

  useEffect(() => {
    registerColumnTitle(id, title);
  }, [
    id,
    title,
    registerColumnTitle,
  ]);

  const items = visibleByColumn.get(id) ?? [];
  const isTarget = dropTarget?.columnId === id;
  const overLimit = limit !== undefined && items.length > limit;

  const indicatorIndex = draggingId && isTarget ? dropTarget.index : null;

  return (
    <ColumnContext.Provider value={id}>
      {/* A fixed column width is the one place this library pins a dimension: the rail is a grid of
          parallel lists, and a column that hugged its content would shift every time a card moved. */}
      <section
        aria-labelledby={headingId}
        className={cn(
          "flex w-72 shrink-0 flex-col gap-3 px-4 first:pl-0 last:pr-0",
          "border-l border-border first:border-l-0",
          className,
        )}
        data-kanban-column={id}
      >
        <header className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h3
              className="truncate text-sm font-medium leading-none"
              id={headingId}
            >
              {title}
            </h3>
            {description && (
              <p className="truncate text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 font-secondary text-xs tabular-nums",
              overLimit ? "text-warning" : "text-muted-foreground",
            )}
          >
            {limit === undefined ? items.length : `${items.length}/${limit}`}
          </span>
        </header>

        {/* The drop-zone listeners sit on the list itself; the cards inside carry the
            interactive roles, so the list stays a plain list for assistive tech. */}
        <ul
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1 transition-colors duration-150 ease",
            isTarget && draggingId && "bg-muted",
          )}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) {
              return;
            }
            if (isTarget) setDropTarget(null);
          }}
          onDragOver={(event) => {
            if (!draggingId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (
              dropTarget?.columnId !== id ||
              dropTarget.index !== items.length
            ) {
              setDropTarget({
                columnId: id,
                index: items.length,
              });
            }
          }}
          onDrop={(event) => {
            if (!draggingId) return;
            event.preventDefault();
            dropAt(
              dropTarget?.columnId === id
                ? dropTarget
                : {
                    columnId: id,
                    index: items.length,
                  },
            );
          }}
        >
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {indicatorIndex === index && <DropIndicator />}
              <Card
                item={item}
                renderItem={renderItem}
              />
            </Fragment>
          ))}

          {indicatorIndex === items.length && items.length > 0 && (
            <DropIndicator />
          )}

          {items.length === 0 && (
            <li className="px-2 py-4 text-xs text-muted-foreground">
              {lang.emptyColumn}
            </li>
          )}
        </ul>

        {children}
      </section>
    </ColumnContext.Provider>
  );
}

/** The 2px ink rule marking where a dragged card will land. */
function DropIndicator() {
  return (
    <li
      aria-hidden="true"
      className="-my-1 h-0.5 rounded-full bg-foreground"
    />
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

const toneClassName: Record<KanbanTone, string> = {
  default: "",
  destructive: "border-l-2 border-l-destructive",
  success: "border-l-2 border-l-success",
  warning: "border-l-2 border-l-warning",
};

export interface KanbanCardProps {
  /** The card to render. */
  item: KanbanItem;
  /** Replaces the card's default body while keeping its shell, drag and keyboard behaviour. */
  renderItem?: (item: KanbanItem) => ReactNode;
  className?: string;
}

/**
 * One draggable card. Handles both input models: a pointer drag, and a keyboard move where Space
 * picks the card up, the arrow keys move it between and within columns, Space drops it and Escape
 * puts the board back.
 */
function Card({ item, renderItem, className }: KanbanCardProps) {
  const {
    draggingId,
    grabbedId,
    startDrag,
    endDrag,
    dropTarget,
    setDropTarget,
    dropAt,
    handleCardKeyDown,
    registerCard,
    lang,
    instructionsId,
    readOnly,
    visibleByColumn,
  } = useKanbanContext();
  const columnId = useContext(ColumnContext);

  const isDragging = draggingId === item.id;
  const isGrabbed = grabbedId === item.id;

  /** Which half of the card the pointer is on decides whether the drop lands before or after it. */
  const updateDropTarget = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId || !columnId) return;
    const siblings = visibleByColumn.get(columnId) ?? [];
    const position = siblings.findIndex(
      (candidate) => candidate.id === item.id,
    );
    if (position === -1) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    const index = position + (after ? 1 : 0);

    if (dropTarget?.columnId !== columnId || dropTarget.index !== index) {
      setDropTarget({
        columnId,
        index,
      });
    }
  };

  return (
    <li>
      {/* biome-ignore lint/a11y/useSemanticElements: a real <button> may only contain phrasing content, and the card body is a block of paragraphs and lists. The div carries the button role, the tab stop, and the full keyboard contract instead. */}
      <div
        aria-describedby={instructionsId}
        aria-roledescription={lang.cardRoleDescription}
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-border bg-background p-3 shadow-xs",
          "transition-[border-color,box-shadow,opacity] duration-150 ease",
          "hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          readOnly ? "cursor-default" : "cursor-grab",
          toneClassName[item.tone ?? "default"],
          isDragging && "opacity-40",
          isGrabbed && "cursor-grabbing border-border-strong shadow-sm",
          className,
        )}
        draggable={!readOnly}
        onDragEnd={endDrag}
        onDragOver={(event) => {
          if (!draggingId) return;
          event.preventDefault();
          event.stopPropagation();
          updateDropTarget(event);
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", item.id);
          startDrag(item.id);
        }}
        onDrop={(event) => {
          if (!draggingId || !dropTarget) return;
          event.preventDefault();
          event.stopPropagation();
          dropAt(dropTarget);
        }}
        onKeyDown={(event) => handleCardKeyDown(event, item)}
        ref={(element) => registerCard(item.id, element)}
        role="button"
        tabIndex={0}
      >
        {renderItem ? renderItem(item) : <CardBody item={item} />}
      </div>
    </li>
  );
}

/**
 * One person on a card. `Avatar.Fallback` only appears once an `<img>` has actually failed, so an
 * assignee with no `src` gets the initials tile directly instead of an empty circle.
 */
function AssigneeAvatar({ assignee }: { assignee: KanbanAssignee }) {
  if (!assignee.src) {
    return (
      <span
        className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-background"
        title={assignee.name}
      >
        {initials(assignee.name)}
      </span>
    );
  }

  return (
    <Avatar
      className="ring-2 ring-background"
      size="sm"
      title={assignee.name}
    >
      <Avatar.Img
        alt={assignee.name}
        src={assignee.src}
      />
      <Avatar.Skeleton />
      <Avatar.Fallback>{initials(assignee.name)}</Avatar.Fallback>
    </Avatar>
  );
}

/** Default card body: tags, title, description, then date and assignees on one meta row. */
function CardBody({ item }: { item: KanbanItem }) {
  const { dateFormat } = useKanbanContext();
  const hasMeta = Boolean(item.date) || Boolean(item.assignees?.length);

  return (
    <>
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              className="rounded-sm bg-muted px-1.5 py-0.5 font-secondary text-xs leading-4 text-muted-foreground"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm font-medium leading-snug">{item.title}</p>

      {item.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      )}

      {hasMeta && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* The 44% tertiary rung fails 4.5:1 at 12px, and a due date is real reading rather
              than optional metadata, so the date sits on the 64% rung. The card's tone is already
              carried by its left rule; colouring the date too would only repeat it below
              contrast. */}
          {item.date ? (
            <span className="flex items-center gap-1.5 font-secondary text-xs tabular-nums text-muted-foreground">
              <Icon
                aria-hidden="true"
                icon={CalendarDays}
                size="xs"
              />
              <time dateTime={item.date.toISOString()}>
                {dateFormat(item.date)}
              </time>
            </span>
          ) : null}

          {item.assignees && item.assignees.length > 0 && (
            <ul className="ml-auto flex -space-x-1.5">
              {item.assignees.map((assignee) => (
                <li key={assignee.name}>
                  <AssigneeAvatar assignee={assignee} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Compound Kanban board — a column rail of draggable cards, with an optional date filter.
 *
 * Every piece is composed by the consumer: `Kanban.Root` owns the cards and the move logic,
 * `Kanban.Board` establishes column order, and each `Kanban.Column` renders the cards whose
 * `columnId` matches its `id`. The date filter is entirely opt-in: without `dateFilter` on the
 * root, `Kanban.DateFilter` renders nothing and undated cards are perfectly normal.
 */
export const Kanban = {
  Board,
  Card,
  Column,
  DateFilter: DateFilterControl,
  Root,
  Summary,
  Title,
  Toolbar,
};
