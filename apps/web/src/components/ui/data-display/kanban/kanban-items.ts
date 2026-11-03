/**
 * Pure item logic for the Kanban board: date filtering, grouping and reordering.
 *
 * It lives outside `kanban.tsx` so the rules that decide *which* card is visible and *where* a
 * moved card lands can be asserted directly in Vitest, without mounting a board or simulating a
 * drag. The component imports these functions; it never reimplements them.
 */

/** A person shown on a card. `src` is optional: the avatar falls back to the initials. */
export interface KanbanAssignee {
  /** Full name, used for the avatar's accessible name and its initials fallback. */
  name: string;
  /** Avatar image URL. When absent or broken, the initials are shown instead. */
  src?: string;
}

/**
 * Semantic state of a card, drawn as a colored left rule. `"default"` draws no rule — colour here
 * means something is genuinely good or bad, it is never a per-column accent.
 */
export type KanbanTone = "default" | "destructive" | "success" | "warning";

/** A single card on the board. */
export interface KanbanItem {
  /** Stable unique id. Used as the React key and as the drag payload. */
  id: string;
  /** Id of the column the card currently sits in. */
  columnId: string;
  /** Card headline. Keep it to one line of plain language. */
  title: string;
  /** Optional supporting line, clamped to two lines on the card. */
  description?: string;
  /**
   * Date this card belongs to (a due date, a delivery date, a sprint day). Optional: a board whose
   * cards carry no date simply never filters them out.
   */
  date?: Date | null;
  /** Short labels rendered as monospace pills — a ticket key, an area, a client. */
  tags?: readonly string[];
  /** People on the card, rendered as an overlapping avatar row. */
  assignees?: readonly KanbanAssignee[];
  /**
   * Semantic state of the card.
   * @default "default"
   */
  tone?: KanbanTone;
}

/** Selected range for a `"range"` date filter. Either end may be open. */
export interface KanbanDateRange {
  /** Earliest visible day, inclusive. `null` leaves the start open. */
  from: Date | null;
  /** Latest visible day, inclusive. `null` leaves the end open. */
  to: Date | null;
}

/** Current selection of the board's date filter, in whichever mode the board was given. */
export type KanbanDateFilter =
  | {
      /** Matches cards falling on one calendar day. */
      mode: "single";
      /** The selected day, or `null` while nothing is selected. */
      value: Date | null;
    }
  | {
      /** Matches cards falling inside an inclusive range of calendar days. */
      mode: "range";
      /** The selected range; either end may be `null`. */
      value: KanbanDateRange;
    };

/** Midnight local time of a date's calendar day, as epoch milliseconds. */
function dayValue(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** `true` when the filter has nothing selected yet, so every card stays visible. */
export function isDateFilterEmpty(filter: KanbanDateFilter | null): boolean {
  if (!filter) return true;
  if (filter.mode === "single") return filter.value === null;
  return filter.value.from === null && filter.value.to === null;
}

/**
 * Decides whether one card survives the date filter.
 *
 * Comparison is by calendar day, never by instant: a card due "today" stays visible no matter what
 * time of day its `Date` carries. Cards with no date are governed by `showUndated`, which is what
 * makes the filter safe to switch on for a board that only partially uses dates.
 */
export function matchesDateFilter(
  item: KanbanItem,
  filter: KanbanDateFilter | null,
  showUndated = true,
): boolean {
  if (isDateFilterEmpty(filter) || !filter) return true;
  if (!item.date) return showUndated;

  const day = dayValue(item.date);

  if (filter.mode === "single") {
    return filter.value ? day === dayValue(filter.value) : true;
  }

  const { from, to } = filter.value;
  if (from && day < dayValue(from)) return false;
  if (to && day > dayValue(to)) return false;
  return true;
}

/** Applies `matchesDateFilter` to a whole board, preserving the original order. */
export function filterItems<T extends KanbanItem>(
  items: readonly T[],
  filter: KanbanDateFilter | null,
  showUndated = true,
): T[] {
  return items.filter((item) => matchesDateFilter(item, filter, showUndated));
}

/** Buckets items by `columnId`, preserving their order inside each bucket. */
export function groupByColumn<T extends KanbanItem>(
  items: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const bucket = groups.get(item.columnId);
    if (bucket) bucket.push(item);
    else
      groups.set(item.columnId, [
        item,
      ]);
  }
  return groups;
}

/**
 * Moves an item to `toColumnId`, landing at `toIndex` of that column's **visible** cards.
 *
 * The board can be filtered, so a visible index is not an index into `items`. The move is therefore
 * anchored: `visibleIds` (the target column's visible cards, in order, without the moved one) names
 * the card the moved one must end up in front of. Filtered-out cards keep their relative position
 * instead of silently jumping to the end of the column.
 *
 * Returns the original array when the item doesn't exist, so a stale drop is a no-op rather than a
 * corrupted board.
 */
export function moveItem<T extends KanbanItem>(
  items: readonly T[],
  itemId: string,
  toColumnId: string,
  toIndex: number,
  visibleIds: readonly string[],
): T[] {
  const current = items.find((item) => item.id === itemId);
  if (!current) return items as T[];

  const moved = {
    ...current,
    columnId: toColumnId,
  };
  const rest = items.filter((item) => item.id !== itemId);

  const anchorId = visibleIds[toIndex];
  if (anchorId !== undefined) {
    const anchorIndex = rest.findIndex((item) => item.id === anchorId);
    if (anchorIndex !== -1) {
      return [
        ...rest.slice(0, anchorIndex),
        moved,
        ...rest.slice(anchorIndex),
      ];
    }
  }

  let lastOfColumn = -1;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index].columnId === toColumnId) lastOfColumn = index;
  }

  const insertAt = lastOfColumn === -1 ? rest.length : lastOfColumn + 1;
  return [
    ...rest.slice(0, insertAt),
    moved,
    ...rest.slice(insertAt),
  ];
}
