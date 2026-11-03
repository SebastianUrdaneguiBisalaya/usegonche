"use client";

import * as React from "react";
import { cn } from "../../utils/tailwind/cn";

const DAY_MS = 86_400_000;

/** `"YYYY-MM-DD"` → epoch milliseconds at UTC midnight. Days are handled as UTC so the calendar never shifts with the viewer's time zone. */
function parseDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface ActivityCalendarEntry {
  /** Calendar day as `"YYYY-MM-DD"`. */
  date: string;
  /** Amount of activity that day (commits, workouts, pages read, tasks done…). Days without an entry count as `0`. */
  count: number;
}

interface ActivityCalendarCell {
  date: string;
  ms: number;
  count: number;
  /** 0 (no activity) to 4 (highest). */
  level: number;
}

interface ActivityCalendarContextValue {
  /** Columns of seven cells (one per weekday); `null` for days outside the range. */
  weeks: (ActivityCalendarCell | null)[][];
  weekStartsOn: 0 | 1;
  total: number;
  color: string;
  unit: string;
  unitPlural: string;
  locale: string;
  cellSize: number;
  onDateSelect?: (entry: ActivityCalendarEntry) => void;
}

const ActivityCalendarContext =
  React.createContext<ActivityCalendarContextValue | null>(null);

function useActivityCalendarContext() {
  const context = React.useContext(ActivityCalendarContext);
  if (!context) {
    throw new Error(
      "ActivityCalendar subcomponents must be used within <ActivityCalendar>.",
    );
  }
  return context;
}

/** Share of `color` (over the canvas) for each level; level 0 is the neutral empty cell. */
const LEVEL_STRENGTH = [
  0,
  28,
  52,
  76,
  100,
] as const;

function levelBackground(level: number, color: string) {
  if (level === 0) return "var(--muted)";
  return `color-mix(in oklab, ${color} ${LEVEL_STRENGTH[level]}%, var(--background))`;
}

export interface ActivityCalendarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Activity per day. Only days with activity need an entry. */
  data: ActivityCalendarEntry[];
  /**
   * Last day shown, as `"YYYY-MM-DD"`. Defaults to today (UTC); pass it explicitly for a fixed, reproducible calendar.
   */
  endDate?: string;
  /**
   * First day shown, as `"YYYY-MM-DD"`. Defaults to 52 weeks (364 days) before `endDate`, i.e. one year of columns.
   */
  startDate?: string;
  /**
   * First row of each column: `0` starts weeks on Sunday, `1` on Monday.
   * @default 0
   */
  weekStartsOn?: 0 | 1;
  /**
   * Color of the strongest level; weaker levels fade toward the canvas, which keeps the gradient pastel in both themes.
   * @default "var(--chart-3)" (the green of the chart palette)
   */
  color?: string;
  /** Upper bounds of levels 1, 2 and 3, ascending; any count above the last is level 4. Set them when levels should mean something fixed (e.g. `[3, 6, 9]`). Defaults to quarters of the busiest day. */
  thresholds?: [
    number,
    number,
    number,
  ];
  /**
   * Singular name of what is counted, used in tooltips and labels.
   * @default "contribution"
   */
  unit?: string;
  /** Plural of `unit`. Defaults to `unit` + `"s"`. */
  unitPlural?: string;
  /**
   * Locale for month, weekday and date names.
   * @default "en-US"
   */
  locale?: string;
  /**
   * Side of each square, in px.
   * @default 12
   */
  cellSize?: number;
  /** Called with a day's entry when its cell is clicked or activated with Enter/Space — for drilling into that day. */
  onDateSelect?: (entry: ActivityCalendarEntry) => void;
}

/**
 * Compound activity calendar — the year-of-squares grid popularized by GitHub
 * profiles: one square per day, columns are weeks, and the shade of each
 * square shows how much happened that day. It is not tied to code: use it to
 * track workouts, habits, study time, support tickets, releases — anything
 * counted per day. Compose `ActivityCalendar.Total`, `Grid` and `Legend`.
 * @example
 * ```tsx
 * <ActivityCalendar data={commits} unit="commit">
 *   <ActivityCalendar.Total />
 *   <ActivityCalendar.Grid />
 *   <ActivityCalendar.Legend />
 * </ActivityCalendar>
 * ```
 */
function ActivityCalendarRoot({
  data,
  endDate,
  startDate,
  weekStartsOn = 0,
  color = "var(--chart-3)",
  thresholds,
  unit = "contribution",
  unitPlural,
  locale = "en-US",
  cellSize = 12,
  onDateSelect,
  className,
  children,
  ...props
}: ActivityCalendarProps) {
  const value = React.useMemo<ActivityCalendarContextValue>(() => {
    const endMs = endDate
      ? parseDay(endDate)
      : Math.floor(Date.now() / DAY_MS) * DAY_MS;
    const startMs = startDate ? parseDay(startDate) : endMs - 364 * DAY_MS;

    const counts = new Map<string, number>();
    for (const entry of data)
      counts.set(entry.date, (counts.get(entry.date) ?? 0) + entry.count);

    let max = 0;
    let total = 0;
    for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
      const count = counts.get(formatDay(ms)) ?? 0;
      total += count;
      max = Math.max(max, count);
    }

    const bounds = thresholds ?? [
      max / 4,
      max / 2,
      (max * 3) / 4,
    ];
    const levelOf = (count: number) =>
      count <= 0
        ? 0
        : count <= bounds[0]
          ? 1
          : count <= bounds[1]
            ? 2
            : count <= bounds[2]
              ? 3
              : 4;

    // The first column starts on the week's first day, on or before `startMs`.
    const startWeekday = new Date(startMs).getUTCDay();
    const gridStart =
      startMs - ((startWeekday - weekStartsOn + 7) % 7) * DAY_MS;
    const weekCount = Math.ceil((endMs - gridStart + DAY_MS) / (7 * DAY_MS));

    const weeks = Array.from(
      {
        length: weekCount,
      },
      (_, week) =>
        Array.from(
          {
            length: 7,
          },
          (_, day): ActivityCalendarCell | null => {
            const ms = gridStart + (week * 7 + day) * DAY_MS;
            if (ms < startMs || ms > endMs) return null;
            const date = formatDay(ms);
            const count = counts.get(date) ?? 0;
            return {
              count,
              date,
              level: levelOf(count),
              ms,
            };
          },
        ),
    );

    return {
      cellSize,
      color,
      locale,
      onDateSelect,
      total,
      unit,
      unitPlural: unitPlural ?? `${unit}s`,
      weekStartsOn,
      weeks,
    };
  }, [
    cellSize,
    color,
    data,
    endDate,
    locale,
    onDateSelect,
    startDate,
    thresholds,
    unit,
    unitPlural,
    weekStartsOn,
  ]);

  return (
    <ActivityCalendarContext.Provider value={value}>
      <div
        className={cn("flex w-full flex-col gap-3 font-primary", className)}
        {...props}
      >
        {children}
      </div>
    </ActivityCalendarContext.Provider>
  );
}

export interface ActivityCalendarTotalProps
  extends Omit<React.HTMLAttributes<HTMLParagraphElement>, "children"> {
  /** Builds the sentence from the total and the unit. Defaults to `"1,234 contributions in this period"`. */
  children?: (total: number, unit: string) => React.ReactNode;
}

/** One-line summary of everything counted in the range. Pass a function to word it your own way (e.g. `(n, unit) => \`${n} ${unit} this year\``). */
function ActivityCalendarTotal({
  children,
  className,
  ...props
}: ActivityCalendarTotalProps) {
  const { total, unit, unitPlural } = useActivityCalendarContext();
  const noun = total === 1 ? unit : unitPlural;
  return (
    <p
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children
        ? children(total, noun)
        : `${total.toLocaleString()} ${noun} in this period`}
    </p>
  );
}

export interface ActivityCalendarGridProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Accessible name of the grid. Defaults to the total, e.g. `"1,234 contributions"`.
   */
  "aria-label"?: string;
  /**
   * Builds each day's accessible description/tooltip text.
   * @default (cell) => `"3 commits on Monday, January 6, 2025"`
   */
  describe?: (cell: ActivityCalendarCell) => string;
}

/**
 * The calendar itself: month labels on top, weekday labels on the left and one
 * square per day. It is a WAI-ARIA grid — a single tab stop, arrow keys move
 * between days, Enter/Space selects — and each square carries its full
 * description (`"3 commits on Monday, January 6, 2025"`), shown as a tooltip
 * on hover and focus. On narrow screens it scrolls horizontally, starting at the
 * most recent weeks.
 */
function ActivityCalendarGrid({
  className,
  "aria-label": ariaLabel,
  describe: describeProp,
  ...props
}: ActivityCalendarGridProps) {
  const {
    weeks,
    weekStartsOn,
    total,
    color,
    unit,
    unitPlural,
    locale,
    cellSize,
    onDateSelect,
  } = useActivityCalendarContext();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [tip, setTip] = React.useState<{
    left: number;
    top: number;
    text: string;
  } | null>(null);

  const lastFilled = React.useMemo(() => {
    for (let week = weeks.length - 1; week >= 0; week--)
      for (let day = 6; day >= 0; day--)
        if (weeks[week][day])
          return [
            week,
            day,
          ] as const;
    return [
      0,
      0,
    ] as const;
  }, [
    weeks,
  ]);
  // Roving tab stop: exactly one cell is tabbable, the others are reached with arrows.
  const [active, setActive] =
    React.useState<
      readonly [
        number,
        number,
      ]
    >(lastFilled);

  // Open on the most recent weeks (the right edge).
  React.useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  });
  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
  const weekdayFormat = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
  });

  // Consecutive columns that share a month collapse into one label.
  const months: {
    label: string;
    span: number;
  }[] = [];
  for (const week of weeks) {
    const first = week.find(Boolean);
    const label = first ? monthFormat.format(first.ms) : "";
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else
      months.push({
        label,
        span: 1,
      });
  }

  const describe =
    describeProp ??
    ((cell: ActivityCalendarCell) =>
      `${cell.count.toLocaleString()} ${cell.count === 1 ? unit : unitPlural} on ${dateFormat.format(cell.ms)}`);

  const showTip = (
    event: React.SyntheticEvent<HTMLElement>,
    cell: ActivityCalendarCell,
  ) => {
    const container = scrollRef.current?.parentElement?.getBoundingClientRect();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!container) return;
    setTip({
      left: rect.left - container.left + rect.width / 2,
      text: describe(cell),
      top: rect.top - container.top,
    });
  };

  const move = (week: number, day: number) => {
    if (!weeks[week]?.[day]) return;
    setActive([
      week,
      day,
    ]);
    tableRef.current
      ?.querySelector<HTMLElement>(`[data-week="${week}"][data-day="${day}"]`)
      ?.focus();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTableCellElement>,
    week: number,
    day: number,
    cell: ActivityCalendarCell,
  ) => {
    const steps: Record<
      string,
      [
        number,
        number,
      ]
    > = {
      ArrowDown: [
        0,
        1,
      ],
      ArrowLeft: [
        -1,
        0,
      ],
      ArrowRight: [
        1,
        0,
      ],
      ArrowUp: [
        0,
        -1,
      ],
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      move(week + step[0], day + step[1]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDateSelect?.({
        count: cell.count,
        date: cell.date,
      });
    }
  };

  return (
    <div className="relative">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: only clears the hover tooltip when the pointer leaves the calendar. */}
      <div
        className={cn("overflow-x-auto pb-1", className)}
        onMouseLeave={() => setTip(null)}
        ref={scrollRef}
        // Keyboard users scroll it by moving through the cells.
        {...props}
      >
        <table
          aria-label={
            ariaLabel ??
            `${total.toLocaleString()} ${total === 1 ? unit : unitPlural}`
          }
          className="border-separate font-primary text-xs text-muted-foreground"
          ref={tableRef}
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the WAI-ARIA grid pattern (one tab stop, arrow-key navigation) is the right model for a calendar of days.
          role="grid"
          style={{
            borderSpacing: 3,
          }}
        >
          <thead>
            <tr>
              <td />
              {months.map((month, index) => (
                <th
                  className="overflow-visible whitespace-nowrap text-left font-normal"
                  colSpan={month.span}
                  // biome-ignore lint/suspicious/noArrayIndexKey: month spans are positional and never reorder.
                  key={index}
                  scope="col"
                >
                  {month.span >= 2 ? (
                    month.label
                  ) : (
                    <span className="sr-only">{month.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(
              {
                length: 7,
              },
              (_, day) => {
                const weekday = (weekStartsOn + day) % 7;
                // 2024-01-07 was a Sunday.
                const name = weekdayFormat.format(
                  Date.UTC(2024, 0, 7 + weekday),
                );
                return (
                  <tr key={weekday}>
                    <th
                      className="p-0 pr-1 text-right font-normal"
                      scope="row"
                      // The label's line box is the square's height, so rows with a visible weekday name are no taller than the rest.
                      style={{
                        height: cellSize,
                        lineHeight: `${cellSize}px`,
                      }}
                    >
                      {day % 2 === 1 ? (
                        name
                      ) : (
                        <span className="sr-only">{name}</span>
                      )}
                    </th>
                    {weeks.map((column, week) => {
                      const cell = column[day];
                      if (!cell)
                        return (
                          <td
                            // Days outside the range still take their square's space, or the row would collapse and misalign.
                            aria-hidden="true"
                            // biome-ignore lint/suspicious/noArrayIndexKey: weeks are positional columns.
                            key={week}
                            style={{
                              height: cellSize,
                              width: cellSize,
                            }}
                          />
                        );
                      const isActive = active[0] === week && active[1] === day;
                      return (
                        <td
                          aria-label={describe(cell)}
                          className={cn(
                            "cursor-default rounded-[3px] border border-border outline-none",
                            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                            onDateSelect && "cursor-pointer",
                          )}
                          data-day={day}
                          data-level={cell.level}
                          data-week={week}
                          // biome-ignore lint/suspicious/noArrayIndexKey: weeks are positional columns.
                          key={week}
                          onBlur={() => setTip(null)}
                          onClick={() =>
                            onDateSelect?.({
                              count: cell.count,
                              date: cell.date,
                            })
                          }
                          onFocus={(event) => {
                            setActive([
                              week,
                              day,
                            ]);
                            showTip(event, cell);
                          }}
                          onKeyDown={(event) =>
                            handleKeyDown(event, week, day, cell)
                          }
                          onMouseEnter={(event) => showTip(event, cell)}
                          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a day cell is an interactive gridcell of the grid above.
                          role="gridcell"
                          style={{
                            background: levelBackground(cell.level, color),
                            height: cellSize,
                            width: cellSize,
                          }}
                          tabIndex={isActive ? 0 : -1}
                        />
                      );
                    })}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-background px-3 py-2 font-primary text-xs text-foreground shadow-md"
          role="tooltip"
          style={{
            left: tip.left,
            top: tip.top - 8,
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

export interface ActivityCalendarLegendProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Text before the scale.
   * @default "Less"
   */
  lessLabel?: string;
  /**
   * Text after the scale.
   * @default "More"
   */
  moreLabel?: string;
}

/** The scale — "Less ▢▢▢▢▢ More" — showing the five shades the squares can take. */
function ActivityCalendarLegend({
  lessLabel = "Less",
  moreLabel = "More",
  className,
  ...props
}: ActivityCalendarLegendProps) {
  const { color, cellSize } = useActivityCalendarContext();
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1.5 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span>{lessLabel}</span>
      {LEVEL_STRENGTH.map((_, level) => (
        <span
          aria-hidden="true"
          className="rounded-[3px] border border-border"
          // biome-ignore lint/suspicious/noArrayIndexKey: the five levels are fixed.
          key={level}
          style={{
            background: levelBackground(level, color),
            height: cellSize,
            width: cellSize,
          }}
        />
      ))}
      <span>{moreLabel}</span>
    </div>
  );
}

export const ActivityCalendar = Object.assign(ActivityCalendarRoot, {
  Grid: ActivityCalendarGrid,
  Legend: ActivityCalendarLegend,
  Total: ActivityCalendarTotal,
});
