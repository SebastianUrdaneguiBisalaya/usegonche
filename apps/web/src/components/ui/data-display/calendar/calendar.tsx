"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "../../actions-controls/button/button";
import { cn } from "../../utils/tailwind/cn";

/*
 * Dates in this component are plain local `Date`s: a calendar day is the day the user sees, regardless of
 * timezone. Timestamps coming from the backend go through `fromUtcTimestamp` (`src/lib/date/utc.ts`) before
 * they are handed to `Calendar.TimeColumn`, `Calendar.Event`, etc., and picked days go back through
 * `toUtcTimestamp`.
 */

/* ---------------------------------- date helpers ---------------------------------- */

/** Day of the week a week starts on: `0` is Sunday, `1` is Monday, … `6` is Saturday. */
export type CalendarWeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Returns a copy of `date` with the time reset to 00:00 local. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Returns a new date `amount` calendar days after `date` (negative goes back). */
export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/** First day of the week that contains `date`, at 00:00 local. */
export function startOfWeek(
  date: Date,
  weekStartsOn: CalendarWeekStart = 1,
): Date {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() - weekStartsOn + 7) % 7));
}

/** Whether both dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Returns `day` at 00:00 local plus `minutes`, so a time of day survives DST boundaries. */
function atMinutes(day: Date, minutes: number): Date {
  const next = startOfDay(day);
  next.setMinutes(minutes);
  return next;
}

/** Returns `day` carrying the time of day of `time`. */
function withTimeOf(day: Date, time: Date): Date {
  const next = startOfDay(day);
  next.setHours(
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  );
  return next;
}

/** Minutes elapsed between local midnight and `date`. */
function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function createFormatters(locale: string) {
  return {
    day: new Intl.DateTimeFormat(locale, {
      day: "numeric",
    }),
    fullDate: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      weekday: "long",
      year: "numeric",
    }),
    hour: new Intl.DateTimeFormat(locale, {
      hour: "numeric",
    }),
    monthShort: new Intl.DateTimeFormat(locale, {
      month: "short",
    }),
    monthYear: new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }),
    range: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }),
    weekday: new Intl.DateTimeFormat(locale, {
      weekday: "short",
    }),
  };
}

/* ------------------------------------- context ------------------------------------- */

/** How many days the calendar shows at once. */
export type CalendarView = "day" | "week";

/** Every user-facing string of the calendar, so it can be translated or reworded. */
export interface CalendarLang {
  /** Accessible name of the scrollable grid region. */
  calendar: string;
  /** Label of the `"day"` view option. */
  day: string;
  /** Label (and accessible name) of the "next period" button. */
  next: string;
  /** Label (and accessible name) of the "previous period" button. */
  previous: string;
  /** Label of the "go to today" button. */
  today: string;
  /** Accessible name of the toolbar. */
  toolbar: string;
  /** Accessible name of the view switcher. */
  view: string;
  /** Label of the `"week"` view option. */
  week: string;
  /** Hint read to screen readers on a movable event, describing the arrow-key shortcuts. */
  moveHint: string;
  /** Prefix of the announcement made after an event is moved, e.g. `"Moved to"`. */
  moved: string;
  /** Hint read to screen readers on a resizable event, describing the modifier + arrow shortcuts. */
  resizeHint: string;
  /** Prefix of the announcement made after an event is resized, e.g. `"New duration"`. */
  resized: string;
}

/** English defaults for `CalendarLang`. */
export const defaultCalendarLang: CalendarLang = {
  calendar: "Calendar",
  day: "Day",
  moved: "Moved to",
  moveHint:
    "Drag the event, or move it with the arrow keys: left and right change the day, up and down change the time.",
  next: "Next",
  previous: "Previous",
  resized: "New duration",
  resizeHint:
    "Drag the top or bottom edge to change the duration, or use Shift + up/down arrows for the end time and Alt + arrows for the start time.",
  today: "Today",
  toolbar: "Calendar navigation",
  view: "View",
  week: "Week",
};

interface CalendarContextValue {
  /** Reference date of the current period. */
  date: Date;
  /** Days rendered as columns, in order. */
  days: Date[];
  formatters: ReturnType<typeof createFormatters>;
  goToToday: () => void;
  lang: CalendarLang;
  locale: string;
  next: () => void;
  previous: () => void;
  setDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  today: Date;
  view: CalendarView;
  weekStartsOn: CalendarWeekStart;
}

const CalendarContext = React.createContext<CalendarContextValue | null>(null);

/**
 * Reads the calendar state (current `date`, `view`, visible `days`, navigation helpers…). Use it inside
 * `<Calendar>` to build custom controls or to map `days` into your own columns.
 */
export function useCalendar() {
  const context = React.useContext(CalendarContext);

  if (!context) {
    throw new Error(
      "Calendar compound components must be used inside <Calendar>.",
    );
  }

  return context;
}

interface TimeGridContextValue {
  endHour: number;
  hourHeight: number;
  startHour: number;
}

const TimeGridContext = React.createContext<TimeGridContextValue | null>(null);

function useTimeGrid() {
  const context = React.useContext(TimeGridContext);

  if (!context) {
    throw new Error(
      "This Calendar piece must be used inside <Calendar.TimeGrid>.",
    );
  }

  return context;
}

/** Set by `Calendar.TimeColumn`; tells a `Calendar.Event` to position itself by time instead of flowing. */
const TimeColumnContext = React.createContext<{
  date: Date;
} | null>(null);

const ResourceRowContext = React.createContext<{
  label: string;
  resourceId?: string;
} | null>(null);

const EventContext = React.createContext<{
  start?: Date;
  end?: Date;
} | null>(null);

/* ---------------------------------- moving events ---------------------------------- */

/** Where an event ended up after being dragged or moved with the keyboard. */
export interface CalendarEventMove {
  /** `eventId` of the event that moved. */
  id: string;
  /** Day it landed on, at 00:00 local. */
  date: Date;
  /** New start. `undefined` when the event had no `start`. */
  start?: Date;
  /** New end, shifted by the same amount as `start`. `undefined` when the event had no `end`. */
  end?: Date;
  /** `resourceId` of the row it landed on. Only set when dropping inside a `Calendar.ResourceCell`. */
  resourceId?: string;
}

/** New hours of an event after its top or bottom edge was dragged, or resized with the keyboard. */
export interface CalendarEventResize {
  /** `eventId` of the event that was resized. */
  id: string;
  /** New start. Unchanged unless the `"start"` edge moved. */
  start: Date;
  /** New end. Unchanged unless the `"end"` edge moved. */
  end: Date;
  /** Which edge the user dragged. */
  edge: "start" | "end";
}

/** Slot the pointer currently hovers, shared so columns and cells can preview the drop. */
interface CalendarDropTarget {
  date: Date;
  /** Minutes from local midnight, or `null` when the slot carries no time (a resource cell). */
  minutes: number | null;
  resourceId?: string;
  resourceLabel?: string;
}

interface CalendarDragState {
  /** `eventId` of the event being dragged. */
  id: string;
  /** Its length in minutes, used to size the drop preview. */
  duration: number;
  target: CalendarDropTarget | null;
}

interface CalendarMoveContextValue {
  announce: (message: string) => void;
  descriptionId: string;
  drag: CalendarDragState | null;
  minEventMinutes: number;
  onEventMove: ((move: CalendarEventMove) => void) | undefined;
  onEventResize: ((resize: CalendarEventResize) => void) | undefined;
  resizeDescriptionId: string;
  setDrag: React.Dispatch<React.SetStateAction<CalendarDragState | null>>;
  snapMinutes: number;
}

const CalendarMoveContext =
  React.createContext<CalendarMoveContextValue | null>(null);

function useCalendarMove() {
  const context = React.useContext(CalendarMoveContext);

  if (!context) {
    throw new Error(
      "Calendar compound components must be used inside <Calendar>.",
    );
  }

  return context;
}

/* -------------------------------------- variants -------------------------------------- */

const calendarGridVariants = cva(
  "max-h-[min(40rem,80dvh)] w-full overflow-auto rounded-xl border border-border bg-background font-primary text-foreground [--calendar-col-min:6.5rem] md:[--calendar-col-min:8rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    defaultVariants: {
      mode: "time",
    },
    variants: {
      mode: {
        resource: "[--calendar-gutter:8rem] md:[--calendar-gutter:12rem]",
        time: "[--calendar-gutter:4rem] md:[--calendar-gutter:5rem]",
      },
    },
  },
);

/**
 * Neutral event fill: a `--muted` wash layered over the solid canvas, so hour lines never show through the
 * event, and the wash still follows the light/dark theme.
 */
const eventFill =
  "bg-background bg-[image:linear-gradient(var(--muted),var(--muted))] hover:bg-[image:linear-gradient(var(--pressed),var(--pressed))]";

const calendarEventVariants = cva(
  "group/event z-[1] flex min-w-0 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-left font-primary text-xs text-foreground transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
  {
    defaultVariants: {
      tone: "default",
    },
    variants: {
      tone: {
        default: `border-border ${eventFill}`,
        // State is carried by the accent bar + the label, never by a colored fill.
        destructive: `border-border border-l-[3px] border-l-destructive ${eventFill}`,
        outline:
          "border-border-strong bg-background hover:bg-[image:linear-gradient(var(--hover),var(--hover))]",
        solid:
          "border-transparent bg-foreground text-background hover:opacity-90",
        success: `border-border border-l-[3px] border-l-success ${eventFill}`,
        warning: `border-border border-l-[3px] border-l-warning ${eventFill}`,
      },
    },
  },
);

const viewSwitchItemVariants = cva(
  "inline-flex h-7.5 cursor-pointer items-center rounded-md px-3 font-primary text-sm font-medium transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    defaultVariants: {
      active: false,
    },
    variants: {
      active: {
        false: "text-foreground-secondary hover:bg-hover",
        true: "bg-pressed text-foreground",
      },
    },
  },
);

/* --------------------------------------- root --------------------------------------- */

export interface CalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "lang"> {
  /** Reference date of the visible period (controlled). The week/day shown is the one that contains it. */
  date?: Date;
  /**
   * Initial reference date when uncontrolled.
   * @default today
   */
  defaultDate?: Date;
  /** Called whenever navigation (previous, next, today) changes the reference date. */
  onDateChange?: (date: Date) => void;
  /** Visible period (controlled). */
  view?: CalendarView;
  /**
   * Initial period when uncontrolled.
   * @default "week"
   */
  defaultView?: CalendarView;
  /** Called when the view changes through `Calendar.ViewSwitch`. */
  onViewChange?: (view: CalendarView) => void;
  /**
   * First day of the week: `0` Sunday, `1` Monday…
   * @default 1
   */
  weekStartsOn?: CalendarWeekStart;
  /**
   * BCP 47 locale used to format weekdays, months and hours.
   * @default "en-US"
   */
  locale?: string;
  /**
   * The date treated as "today" (highlighted column, now indicator). Mostly useful for tests and stories.
   * @default new Date()
   */
  today?: Date;
  /**
   * Texts rendered by this component. Merges over English defaults.
   * @default defaultCalendarLang
   */
  lang?: Partial<CalendarLang>;
  /**
   * Called when an event is dropped on another day/hour, or moved there with the arrow keys. Passing it is
   * what makes events movable — each movable `Calendar.Event` also needs an `eventId`. The calendar never
   * mutates your data: re-render the events with their new dates yourself.
   */
  onEventMove?: (move: CalendarEventMove) => void;
  /**
   * Called when an event's top or bottom edge is dragged, or resized with the keyboard, changing only its
   * hours. Passing it is what makes events resizable — each one also needs an `eventId`, a `start` and an
   * `end`, and must live inside a `Calendar.TimeGrid`. As with `onEventMove`, you own the new dates.
   */
  onEventResize?: (resize: CalendarEventResize) => void;
  /**
   * Granularity, in minutes, a moved or resized event snaps to inside a `Calendar.TimeGrid`.
   * @default 15
   */
  snapMinutes?: number;
  /**
   * Shortest duration, in minutes, an event can be resized to.
   * @default the calendar's `snapMinutes`
   */
  minEventMinutes?: number;
}

/**
 * Root of the calendar. Owns the reference date and the view, and shares them (plus the derived list of
 * visible days) with every piece through Context. Both props pairs (`date`/`defaultDate`, `view`/`defaultView`)
 * work controlled or uncontrolled.
 */
function CalendarRoot({
  children,
  className,
  date: dateProp,
  defaultDate,
  defaultView = "week",
  lang,
  locale = "en-US",
  minEventMinutes,
  onDateChange,
  onEventMove,
  onEventResize,
  onViewChange,
  snapMinutes = 15,
  today: todayProp,
  view: viewProp,
  weekStartsOn = 1,
  ...props
}: CalendarProps) {
  const todayTime = todayProp?.getTime();
  const today = React.useMemo(
    () =>
      startOfDay(todayTime === undefined ? new Date() : new Date(todayTime)),
    [
      todayTime,
    ],
  );

  const [internalDate, setInternalDate] = React.useState(() =>
    startOfDay(defaultDate ?? today),
  );
  const [internalView, setInternalView] =
    React.useState<CalendarView>(defaultView);
  const [drag, setDrag] = React.useState<CalendarDragState | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const descriptionId = React.useId();
  const resizeDescriptionId = React.useId();

  const isDateControlled = dateProp !== undefined;
  const date = isDateControlled ? startOfDay(dateProp) : internalDate;
  const view = viewProp ?? internalView;

  const setDate = React.useCallback(
    (next: Date) => {
      const day = startOfDay(next);
      if (!isDateControlled) setInternalDate(day);
      onDateChange?.(day);
    },
    [
      isDateControlled,
      onDateChange,
    ],
  );

  const setView = React.useCallback(
    (next: CalendarView) => {
      if (viewProp === undefined) setInternalView(next);
      onViewChange?.(next);
    },
    [
      onViewChange,
      viewProp,
    ],
  );

  const dateTime = date.getTime();
  const days = React.useMemo(() => {
    const reference = new Date(dateTime);
    if (view === "day")
      return [
        reference,
      ];
    const first = startOfWeek(reference, weekStartsOn);
    return Array.from(
      {
        length: 7,
      },
      (_, index) => addDays(first, index),
    );
  }, [
    dateTime,
    view,
    weekStartsOn,
  ]);

  const formatters = React.useMemo(
    () => createFormatters(locale),
    [
      locale,
    ],
  );

  const value = React.useMemo<CalendarContextValue>(() => {
    const step = view === "week" ? 7 : 1;
    return {
      date,
      days,
      formatters,
      goToToday: () => setDate(today),
      lang: {
        ...defaultCalendarLang,
        ...lang,
      },
      locale,
      next: () => setDate(addDays(date, step)),
      previous: () => setDate(addDays(date, -step)),
      setDate,
      setView,
      today,
      view,
      weekStartsOn,
    };
  }, [
    date,
    days,
    formatters,
    lang,
    locale,
    setDate,
    setView,
    today,
    view,
    weekStartsOn,
  ]);

  const moveValue = React.useMemo<CalendarMoveContextValue>(
    () => ({
      announce: setAnnouncement,
      descriptionId,
      drag,
      minEventMinutes: minEventMinutes ?? snapMinutes,
      onEventMove,
      onEventResize,
      resizeDescriptionId,
      setDrag,
      snapMinutes,
    }),
    [
      descriptionId,
      drag,
      minEventMinutes,
      onEventMove,
      onEventResize,
      resizeDescriptionId,
      snapMinutes,
    ],
  );

  return (
    <CalendarContext.Provider value={value}>
      <CalendarMoveContext.Provider value={moveValue}>
        <div
          {...props}
          className={cn("flex w-full flex-col gap-4", className)}
          data-view={view}
        >
          {children}
          {onEventMove ? (
            <span
              className="sr-only"
              id={descriptionId}
            >
              {value.lang.moveHint}
            </span>
          ) : null}
          {onEventResize ? (
            <span
              className="sr-only"
              id={resizeDescriptionId}
            >
              {value.lang.resizeHint}
            </span>
          ) : null}
          {onEventMove || onEventResize ? (
            // Keyboard moves and resizes are silent otherwise: this announces the result.
            <span
              aria-live="polite"
              className="sr-only"
              role="status"
            >
              {announcement}
            </span>
          ) : null}
        </div>
      </CalendarMoveContext.Provider>
    </CalendarContext.Provider>
  );
}

/* -------------------------------------- header -------------------------------------- */

export interface CalendarHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Top bar of the calendar. Wraps onto two rows on narrow screens so the toolbar never overflows. */
function CalendarHeader({ className, ...props }: CalendarHeaderProps) {
  return (
    <div
      {...props}
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3",
        className,
      )}
    />
  );
}

export interface CalendarDateBadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Small "calendar leaf" showing the month and day of the reference date. Decorative: `Calendar.Title` carries the same info. */
function CalendarDateBadge({ className, ...props }: CalendarDateBadgeProps) {
  const { date, formatters } = useCalendar();

  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn(
        "flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border font-primary",
        className,
      )}
    >
      <span className="w-full bg-muted py-0.5 text-center text-[11px] leading-4 font-medium text-foreground-secondary">
        {capitalize(formatters.monthShort.format(date).replace(".", ""))}
      </span>
      <span className="py-0.5 text-lg leading-6 font-medium text-foreground">
        {formatters.day.format(date)}
      </span>
    </div>
  );
}

export interface CalendarTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

/**
 * Heading with the month and year of the reference date. Pass `children` to replace it. It is an
 * `aria-live` region, so navigating announces the new period to screen readers.
 */
function CalendarTitle({ children, className, ...props }: CalendarTitleProps) {
  const { date, formatters } = useCalendar();

  return (
    <h2
      aria-live="polite"
      {...props}
      className={cn(
        "font-primary text-base leading-6 font-medium text-foreground",
        className,
      )}
    >
      {children ?? capitalize(formatters.monthYear.format(date))}
    </h2>
  );
}

export interface CalendarDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

/** Supporting line under the title: the visible date range (or the full date in day view). Pass `children` to replace it. */
function CalendarDescription({
  children,
  className,
  ...props
}: CalendarDescriptionProps) {
  const { date, days, formatters, view } = useCalendar();
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <p
      {...props}
      className={cn(
        "font-primary text-sm leading-5 text-foreground-secondary",
        className,
      )}
    >
      {children ??
        (view === "day" || !first || !last
          ? capitalize(formatters.fullDate.format(date))
          : formatters.range.formatRange(first, last))}
    </p>
  );
}

export interface CalendarToolbarProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Group for the navigation controls and any custom action (e.g. an "Add event" button). */
function CalendarToolbar({ className, ...props }: CalendarToolbarProps) {
  const { lang } = useCalendar();

  return (
    <div
      aria-label={lang.toolbar}
      role="toolbar"
      {...props}
      className={cn("flex flex-wrap items-center gap-2", className)}
    />
  );
}

export interface CalendarNavigationProps
  extends Omit<ButtonProps, "lang" | "loading"> {}

/** Icon button that moves the calendar one period back (a week or a day, depending on the view). */
function CalendarPrevious({
  children,
  className,
  onClick,
  ...props
}: CalendarNavigationProps) {
  const { lang, previous } = useCalendar();

  return (
    <Button
      aria-label={lang.previous}
      size="icon"
      variant="secondary"
      {...props}
      className={cn("size-9 p-0", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) previous();
      }}
    >
      {children ?? <Button.Icon icon={ChevronLeft} />}
    </Button>
  );
}

/** Icon button that moves the calendar one period forward (a week or a day, depending on the view). */
function CalendarNext({
  children,
  className,
  onClick,
  ...props
}: CalendarNavigationProps) {
  const { lang, next } = useCalendar();

  return (
    <Button
      aria-label={lang.next}
      size="icon"
      variant="secondary"
      {...props}
      className={cn("size-9 p-0", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) next();
      }}
    >
      {children ?? <Button.Icon icon={ChevronRight} />}
    </Button>
  );
}

/** Button that jumps back to the period containing today. Its label is `lang.today` unless `children` is set. */
function CalendarToday({
  children,
  onClick,
  ...props
}: CalendarNavigationProps) {
  const { goToToday, lang } = useCalendar();

  return (
    <Button
      variant="secondary"
	  className={"size-9 px-8"}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) goToToday();
      }}
    >
      <Button.Text>{children ?? lang.today}</Button.Text>
    </Button>
  );
}

export interface CalendarViewSwitchProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Views offered, in order.
   * @default ["day", "week"]
   */
  views?: CalendarView[];
}

/** Segmented control that switches between the day and week views. Uses `aria-pressed` toggle buttons. */
function CalendarViewSwitch({
  className,
  views = [
    "day",
    "week",
  ],
  ...props
}: CalendarViewSwitchProps) {
  const { lang, setView, view } = useCalendar();

  return (
    <div
      aria-label={lang.view}
      role="group"
      {...props}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5",
        className,
      )}
    >
      {views.map((option) => (
        <button
          aria-pressed={view === option}
          className={viewSwitchItemVariants({
            active: view === option,
          })}
          key={option}
          onClick={() => setView(option)}
          type="button"
        >
          {lang[option]}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------- grid --------------------------------------- */

export interface CalendarGridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calendarGridVariants> {
  /**
   * Which body the grid hosts. It only sizes the left gutter: narrow for hour labels (`"time"`), wide for
   * people names (`"resource"`).
   * @default "time"
   */
  mode?: "time" | "resource";
}

/**
 * Scroll container shared by the day header and the body (`TimeGrid` or `ResourceGrid`). Scrolls in both
 * axes, keeps the day header and the left gutter sticky, and is focusable so keyboard users can scroll it.
 * Below the `md` breakpoint columns keep a minimum width and the grid scrolls horizontally instead of
 * squeezing the week.
 */
function CalendarGrid({
  "aria-label": ariaLabel,
  children,
  className,
  mode = "time",
  ...props
}: CalendarGridProps) {
  const { days, lang } = useCalendar();

  return (
    <div
      aria-label={ariaLabel ?? lang.calendar}
      data-calendar-scroll=""
      role="region"
      tabIndex={0}
      {...props}
      className={cn(
        calendarGridVariants({
          mode,
        }),
        className,
      )}
    >
      <div
        className="relative"
        style={
          {
            "--calendar-columns": `var(--calendar-gutter) repeat(${days.length}, minmax(var(--calendar-col-min), 1fr))`,
            minWidth: `calc(var(--calendar-gutter) + ${days.length} * var(--calendar-col-min))`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}

/** State passed to the render function of `Calendar.DayHeader`. */
export interface CalendarDayState {
  /** Whether the day is the calendar's `today`. */
  isToday: boolean;
}

export interface CalendarDayHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Content of the top-left corner cell, above the gutter (e.g. a "Team" label in resource mode). */
  gutter?: React.ReactNode;
  /** Render function for each day's header cell. Defaults to a weekday label plus the day number. */
  children?: (day: Date, state: CalendarDayState) => React.ReactNode;
}

/**
 * Sticky row with one header cell per visible day. Today's number is drawn as a filled dot and marked with
 * `aria-current="date"`.
 */
function CalendarDayHeader({
  children,
  className,
  gutter,
  ...props
}: CalendarDayHeaderProps) {
  const { days, formatters, today } = useCalendar();

  return (
    <div
      {...props}
      className={cn(
        "sticky top-0 z-20 grid grid-cols-(--calendar-columns) border-b border-border bg-background",
        className,
      )}
    >
      <div className="sticky left-0 z-10 flex min-w-0 items-end bg-background px-3 py-2 font-primary text-xs text-foreground-secondary">
        {gutter}
      </div>
      {days.map((day) => {
        const isToday = isSameDay(day, today);

        return (
          <div
            className="flex min-w-0 items-center gap-2 border-l border-border px-3 py-2 font-primary"
            key={day.getTime()}
          >
            {children ? (
              children(day, {
                isToday,
              })
            ) : (
              <>
                <span className="truncate text-xs text-foreground-secondary">
                  {capitalize(formatters.weekday.format(day).replace(".", ""))}
                </span>
                <span
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-sm font-medium",
                    isToday
                      ? "bg-foreground text-background"
                      : "text-foreground",
                  )}
                >
                  {formatters.day.format(day)}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------- time mode ------------------------------------- */

export interface CalendarTimeGridProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * First hour shown (0–23).
   * @default 0
   */
  startHour?: number;
  /**
   * Hour where the grid ends, exclusive (1–24).
   * @default 24
   */
  endHour?: number;
  /**
   * Height of one hour in pixels. Event heights scale with it.
   * @default 56
   */
  hourHeight?: number;
  /** Hour to scroll into view on mount (e.g. `8` to open at 8 AM). */
  scrollToHour?: number;
  /** The day columns. Pass a function to receive the visible days, or place `Calendar.TimeColumn`s yourself. */
  children?: React.ReactNode | ((days: Date[]) => React.ReactNode);
}

/**
 * Body of the date × hour layout (Google Calendar style). Renders the hour axis in the sticky left gutter and
 * hosts one `Calendar.TimeColumn` per day, which you provide as children.
 */
function CalendarTimeGrid({
  children,
  className,
  endHour = 24,
  hourHeight = 56,
  scrollToHour,
  startHour = 0,
  style,
  ...props
}: CalendarTimeGridProps) {
  const { days, formatters } = useCalendar();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollToHour === undefined) return;
    const scroller = ref.current?.closest<HTMLElement>(
      "[data-calendar-scroll]",
    );
    if (scroller) {
      scroller.scrollTop = Math.max(0, (scrollToHour - startHour) * hourHeight);
    }
  }, [
    hourHeight,
    scrollToHour,
    startHour,
  ]);

  const value = React.useMemo(
    () => ({
      endHour,
      hourHeight,
      startHour,
    }),
    [
      endHour,
      hourHeight,
      startHour,
    ],
  );

  // Hour 0 has no label: it sits on the header border, like the first line of the grid.
  const labelledHours = Array.from(
    {
      length: Math.max(0, endHour - startHour - 1),
    },
    (_, index) => startHour + index + 1,
  );

  return (
    <TimeGridContext.Provider value={value}>
      <div
        {...props}
        className={cn(
          "relative isolate -mt-px grid grid-cols-(--calendar-columns)",
          className,
        )}
        ref={ref}
        style={
          {
            "--calendar-hour-height": `${hourHeight}px`,
            height: (endHour - startHour) * hourHeight,
            ...style,
          } as React.CSSProperties
        }
      >
        <div
          aria-hidden="true"
          className="sticky left-0 z-10 bg-background"
        >
          {labelledHours.map((hour) => (
            <span
              className="absolute left-3 -translate-y-1/2 font-primary text-xs text-foreground-secondary"
              key={hour}
              style={{
                top: (hour - startHour) * hourHeight,
              }}
            >
              {formatters.hour.format(new Date(2000, 0, 1, hour))}
            </span>
          ))}
        </div>
        {typeof children === "function" ? children(days) : children}
      </div>
    </TimeGridContext.Provider>
  );
}

export interface CalendarTimeColumnProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Calendar day this column represents. Events inside are positioned relative to it. */
  date: Date;
}

/**
 * One day's column inside `Calendar.TimeGrid`. It draws the hour lines and is the positioning context for
 * timed `Calendar.Event`s, but its content is entirely yours: events, custom markers, blocked-time overlays…
 */
function CalendarTimeColumn({
  children,
  className,
  date,
  ...props
}: CalendarTimeColumnProps) {
  const { formatters, today } = useCalendar();
  const { drag } = useCalendarMove();
  const timeGrid = React.useContext(TimeGridContext);
  const isToday = isSameDay(date, today);
  const value = React.useMemo(
    () => ({
      date,
    }),
    [
      date,
    ],
  );

  // Dashed outline showing where the event being dragged would land if it were dropped now.
  const target = drag?.target;
  const preview =
    timeGrid &&
    target &&
    target.minutes !== null &&
    isSameDay(target.date, date)
      ? {
          height: Math.max(
            (drag.duration / 60) * timeGrid.hourHeight - 2,
            MIN_EVENT_HEIGHT,
          ),
          top:
            ((target.minutes - timeGrid.startHour * 60) / 60) *
              timeGrid.hourHeight +
            1,
        }
      : null;

  return (
    <TimeColumnContext.Provider value={value}>
      <div
        aria-label={capitalize(formatters.fullDate.format(date))}
        data-calendar-date={date.getTime()}
        data-calendar-drop="time"
        data-today={isToday ? "" : undefined}
        role="group"
        {...props}
        className={cn(
          "relative min-w-0 border-l border-border bg-[linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[100%_var(--calendar-hour-height)] data-today:bg-hover/40",
          className,
        )}
      >
        {preview ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0.5 z-2 rounded-md border border-dashed border-border-strong bg-hover"
            style={preview}
          />
        ) : null}
        {children}
      </div>
    </TimeColumnContext.Provider>
  );
}

export interface CalendarNowIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Instant to draw the line at. Omit it to follow the real clock (updated every minute, client-side only). */
  now?: Date;
}

/**
 * Dotted "current time" line across the whole time grid, with the time in the gutter. Renders nothing when
 * today is not among the visible days or the time is outside the grid's hour range. Decorative
 * (`aria-hidden`).
 */
function CalendarNowIndicator({
  className,
  now: nowProp,
  ...props
}: CalendarNowIndicatorProps) {
  const { days, formatters } = useCalendar();
  const { endHour, hourHeight, startHour } = useTimeGrid();
  const [clock, setClock] = React.useState<Date | null>(null);

  // Read the clock after mount only: rendering `new Date()` on the server would mismatch on hydration.
  React.useEffect(() => {
    if (nowProp) return;
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(id);
  }, [
    nowProp,
  ]);

  const now = nowProp ?? clock;
  if (!now || !days.some((day) => isSameDay(day, now))) return null;

  const minutes = now.getHours() * 60 + now.getMinutes() - startHour * 60;
  if (minutes < 0 || minutes > (endHour - startHour) * 60) return null;

  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 flex -translate-y-1/2 items-center",
        className,
      )}
      style={{
        top: (minutes / 60) * hourHeight,
      }}
    >
      <div className="sticky left-0 flex w-(--calendar-gutter) shrink-0 items-center gap-1 bg-background py-0.5 pl-2">
        <span className="font-primary text-xs font-medium whitespace-nowrap text-foreground">
          {formatters.time.format(now)}
        </span>
        <span className="size-1.5 rounded-full bg-foreground" />
      </div>
      <div className="flex-1 border-t border-dotted border-foreground" />
    </div>
  );
}

/* ----------------------------------- resource mode ----------------------------------- */

export interface CalendarResourceGridProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Body of the date × person layout. Hosts one `Calendar.ResourceRow` per person (or room, team, machine…),
 * which you provide as children.
 */
function CalendarResourceGrid({
  className,
  ...props
}: CalendarResourceGridProps) {
  return (
    <div
      {...props}
      className={cn("relative isolate flex flex-col", className)}
    />
  );
}

export interface CalendarResourceRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Name of the person/resource. Not rendered: it names the row and its cells for assistive technology. */
  label: string;
  /**
   * Stable id of the person/resource, reported back by `onEventMove` when an event is dropped in this row.
   * @default the row's `label`
   */
  resourceId?: string;
  /** The row's content. Pass a function to receive the visible days, or place the label and cells yourself. */
  children?: React.ReactNode | ((days: Date[]) => React.ReactNode);
}

/** One person's row: a `Calendar.ResourceLabel` in the gutter followed by one `Calendar.ResourceCell` per day. */
function CalendarResourceRow({
  children,
  className,
  label,
  resourceId,
  ...props
}: CalendarResourceRowProps) {
  const { days } = useCalendar();
  const value = React.useMemo(
    () => ({
      label,
      resourceId: resourceId ?? label,
    }),
    [
      label,
      resourceId,
    ],
  );

  return (
    <ResourceRowContext.Provider value={value}>
      <div
        aria-label={label}
        role="group"
        {...props}
        className={cn(
          "grid grid-cols-(--calendar-columns) border-b border-border last:border-b-0",
          className,
        )}
      >
        {typeof children === "function" ? children(days) : children}
      </div>
    </ResourceRowContext.Provider>
  );
}

export interface CalendarResourceLabelProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Sticky gutter cell of a row. Free content: typically an `Avatar` plus a name and role. */
function CalendarResourceLabel({
  className,
  ...props
}: CalendarResourceLabelProps) {
  return (
    <div
      {...props}
      className={cn(
        "sticky left-0 z-10 flex min-w-0 items-start gap-3 bg-background p-3 font-primary",
        className,
      )}
    />
  );
}

export interface CalendarResourceCellProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Calendar day this cell represents. */
  date: Date;
}

/**
 * Intersection of one person's row and one day's column. Tasks stack vertically inside it; its content is
 * entirely yours (events, counters, availability markers, an "add" button…).
 */
function CalendarResourceCell({
  children,
  className,
  date,
  ...props
}: CalendarResourceCellProps) {
  const { formatters, today } = useCalendar();
  const { drag } = useCalendarMove();
  const row = React.useContext(ResourceRowContext);
  const isToday = isSameDay(date, today);
  const dateLabel = capitalize(formatters.fullDate.format(date));
  const target = drag?.target;
  const isDropTarget = Boolean(
    target &&
      target.minutes === null &&
      isSameDay(target.date, date) &&
      target.resourceId === row?.resourceId,
  );

  return (
    <div
      aria-label={row ? `${row.label}, ${dateLabel}` : dateLabel}
      data-calendar-date={date.getTime()}
      data-calendar-drop="resource"
      data-calendar-resource={row?.resourceId}
      data-calendar-resource-label={row?.label}
      data-drop-target={isDropTarget ? "" : undefined}
      data-today={isToday ? "" : undefined}
      role="group"
      {...props}
      className={cn(
        "flex min-h-20 min-w-0 flex-col gap-1 border-l border-border p-1.5 data-today:bg-hover/40 data-drop-target:bg-hover data-drop-target:inset-ring-2 data-drop-target:inset-ring-border-strong",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --------------------------------------- events --------------------------------------- */

export interface CalendarEventProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof calendarEventVariants> {
  /**
   * Visual tone. `default`, `outline` and `solid` are neutral; `success`, `warning` and `destructive` add
   * a colored accent bar for genuine state.
   * @default "default"
   */
  tone?:
    | "default"
    | "outline"
    | "solid"
    | "success"
    | "warning"
    | "destructive";
  /** Start of the event. Inside a `Calendar.TimeColumn` it sets the vertical position. */
  start?: Date;
  /** End of the event. Inside a `Calendar.TimeColumn` it sets the height (one hour if omitted). */
  end?: Date;
  /**
   * Zero-based horizontal slot for overlapping events inside a `Calendar.TimeColumn`.
   * @default 0
   */
  lane?: number;
  /**
   * How many slots the overlapping group is split into.
   * @default 1
   */
  lanes?: number;
  /** Stable id reported back by the calendar's `onEventMove`. Required for the event to be movable. */
  eventId?: string;
  /**
   * Whether this event may be moved when the calendar has an `onEventMove`. Set it to `false` for events
   * that are pinned (a holiday, someone else's booking…).
   * @default true
   */
  movable?: boolean;
  /**
   * Whether this event's hours may be stretched from its top/bottom edge when the calendar has an
   * `onEventResize`. Set it to `false` for events with a fixed duration.
   * @default true
   */
  resizable?: boolean;
}

const MIN_EVENT_HEIGHT = 22;

interface CalendarEventResizeGripProps {
  /** Which edge of the event this grip drags: `"start"` sits on top, `"end"` at the bottom. */
  edge: "start" | "end";
  onPointerDown: (event: React.PointerEvent<HTMLSpanElement>) => void;
}

/**
 * Thin grab strip along an event's top or bottom edge. Decorative and not focusable on purpose: it lives
 * inside the event `<button>` (which may not contain interactive descendants), and keyboard users resize the
 * focused event with Shift/Alt + the arrow keys instead.
 */
function CalendarEventResizeGrip({
  edge,
  onPointerDown,
}: CalendarEventResizeGripProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-x-0 flex h-2 touch-none items-center justify-center",
        edge === "start" ? "top-0 cursor-n-resize" : "bottom-0 cursor-s-resize",
      )}
      onPointerDown={onPointerDown}
    >
      <span className="h-0.5 w-6 rounded-full bg-border-strong opacity-0 transition-opacity duration-150 ease-in-out group-hover/event:opacity-100 group-focus-visible/event:opacity-100 group-data-[tone=solid]/event:bg-background/60" />
    </span>
  );
}

/**
 * A task or appointment. Renders a `<button>` (events are interactive: open, edit, drag handle…), so it is
 * keyboard reachable. Inside a `Calendar.TimeColumn` it is absolutely positioned from `start`/`end`; inside a
 * `Calendar.ResourceCell` (or anywhere else) it simply flows as a full-width block.
 *
 * With an `eventId` it also becomes interactive in two more ways, each opted into on the calendar root:
 * `onEventMove` lets the user drag it to another slot (or move it with the arrow keys), and `onEventResize`
 * adds a grab strip on its top and bottom edges that changes its hours (Shift/Alt + ↑ ↓ for the keyboard).
 */
function CalendarEvent({
  "aria-describedby": ariaDescribedBy,
  children,
  className,
  end,
  eventId,
  lane = 0,
  lanes = 1,
  movable = true,
  onClick,
  onKeyDown,
  onPointerDown,
  resizable = true,
  start,
  style,
  tone = "default",
  type = "button",
  ...props
}: CalendarEventProps) {
  const column = React.useContext(TimeColumnContext);
  const timeGrid = React.useContext(TimeGridContext);
  const row = React.useContext(ResourceRowContext);
  const { formatters, lang, today } = useCalendar();
  const move = useCalendarMove();
  /** Hours being previewed while an edge is dragged, as minutes from local midnight. Committed on release. */
  const [resizePreview, setResizePreview] = React.useState<{
    start: number;
    end: number;
  } | null>(null);

  // While resizing, the event renders (and reports its time) from the preview, so the drag reads as live.
  const effectiveStart =
    resizePreview && column
      ? atMinutes(column.date, resizePreview.start)
      : start;
  const effectiveEnd =
    resizePreview && column ? atMinutes(column.date, resizePreview.end) : end;

  const eventValue = React.useMemo(
    () => ({
      end: effectiveEnd,
      start: effectiveStart,
    }),
    [
      effectiveEnd,
      effectiveStart,
    ],
  );

  const isMovable = Boolean(move.onEventMove && eventId && movable);
  const isResizable = Boolean(
    move.onEventResize &&
      eventId &&
      resizable &&
      column &&
      timeGrid &&
      start &&
      end,
  );
  const isDragging = move.drag?.id === eventId && eventId !== undefined;
  // A drag ends with a click on the button; this swallows that one click so moving never "opens" the event.
  const draggedRef = React.useRef(false);
  // Minutes the event spans, used both to clamp it inside the grid and to size the drop preview.
  const duration =
    start && end ? (end.getTime() - start.getTime()) / 60_000 : start ? 60 : 0;

  const applyMove = (target: CalendarDropTarget) => {
    if (!eventId || !move.onEventMove) return;

    const date = startOfDay(target.date);
    const nextStart = start
      ? target.minutes === null
        ? withTimeOf(date, start)
        : atMinutes(date, target.minutes)
      : undefined;
    const nextEnd =
      nextStart && start && end
        ? new Date(nextStart.getTime() + (end.getTime() - start.getTime()))
        : undefined;

    move.onEventMove({
      date,
      end: nextEnd,
      id: eventId,
      resourceId: target.resourceId,
      start: nextStart,
    });
    const where = [
      capitalize(formatters.fullDate.format(nextStart ?? date)),
      nextStart ? formatters.time.format(nextStart) : null,
      target.resourceLabel,
    ]
      .filter(Boolean)
      .join(", ");
    move.announce(`${lang.moved} ${where}`);
  };

  /** Clamps a dragged edge: it never crosses the other one (minus `minEventMinutes`) nor leaves the grid. */
  const clampResize = (edge: "start" | "end", minutes: number) => {
    const startMinutes = minutesOfDay(start as Date);
    const endMinutes = startMinutes + duration;
    const { endHour, startHour } = timeGrid as TimeGridContextValue;

    return edge === "end"
      ? {
          end: Math.min(
            Math.max(minutes, startMinutes + move.minEventMinutes),
            endHour * 60,
          ),
          start: startMinutes,
        }
      : {
          end: endMinutes,
          start: Math.min(
            Math.max(minutes, startHour * 60),
            endMinutes - move.minEventMinutes,
          ),
        };
  };

  const applyResize = (
    next: {
      start: number;
      end: number;
    },
    edge: "start" | "end",
  ) => {
    if (!eventId || !move.onEventResize || !column) return;

    const nextStart = atMinutes(column.date, next.start);
    const nextEnd = atMinutes(column.date, next.end);

    move.onEventResize({
      edge,
      end: nextEnd,
      id: eventId,
      start: nextStart,
    });
    move.announce(
      `${lang.resized} ${formatters.time.formatRange(nextStart, nextEnd)}`,
    );
  };

  const handleResizePointerDown =
    (edge: "start" | "end") => (event: React.PointerEvent<HTMLSpanElement>) => {
      // The grip lives inside the event button: this keeps the pointer from also starting a move.
      event.stopPropagation();
      if (!isResizable || event.button !== 0 || !timeGrid) return;

      const grip = event.currentTarget;
      const columnElement = grip.closest<HTMLElement>(
        '[data-calendar-drop="time"]',
      );
      if (!columnElement) return;

      const { pointerId } = event;
      const { hourHeight, startHour } = timeGrid;
      let latest: {
        start: number;
        end: number;
      } | null = null;

      const finish = (commit: boolean) => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        window.removeEventListener("keydown", handleEscape, true);
        if (grip.hasPointerCapture(pointerId))
          grip.releasePointerCapture(pointerId);
        setResizePreview(null);
        if (!latest) return;
        // Releasing over the grip also fires a click on the event button; swallow that one.
        draggedRef.current = true;
        if (commit) applyResize(latest, edge);
      };

      const handleMove = (pointer: PointerEvent) => {
        const rect = columnElement.getBoundingClientRect();
        const raw =
          ((pointer.clientY - rect.top) / hourHeight) * 60 + startHour * 60;
        latest = clampResize(
          edge,
          Math.round(raw / move.snapMinutes) * move.snapMinutes,
        );
        setResizePreview(latest);
      };
      const handleUp = () => finish(true);
      const handleCancel = () => finish(false);
      const handleEscape = (key: KeyboardEvent) => {
        if (key.key !== "Escape") return;
        key.preventDefault();
        finish(false);
      };

      grip.setPointerCapture(pointerId);
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
      window.addEventListener("keydown", handleEscape, true);
    };

  /**
   * Maps a pointer position to the slot under it: the topmost `[data-calendar-drop]` element, plus — in a
   * time grid — the snapped start that keeps the event under the same point where it was grabbed.
   */
  const resolveTarget = (
    clientX: number,
    clientY: number,
    grabMinutes: number,
  ): CalendarDropTarget | null => {
    const element = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-calendar-drop]");
    if (!element) return null;

    const time = Number(element.dataset.calendarDate);
    if (!Number.isFinite(time)) return null;
    const date = new Date(time);

    if (element.dataset.calendarDrop === "time" && timeGrid) {
      const { endHour, hourHeight, startHour } = timeGrid;
      const rect = element.getBoundingClientRect();
      const pointerMinutes =
        ((clientY - rect.top) / hourHeight) * 60 + startHour * 60;
      const snapped =
        Math.round((pointerMinutes - grabMinutes) / move.snapMinutes) *
        move.snapMinutes;

      return {
        date,
        minutes: Math.min(
          Math.max(snapped, startHour * 60),
          endHour * 60 - duration,
        ),
      };
    }

    return {
      date,
      minutes: null,
      resourceId: element.dataset.calendarResource,
      resourceLabel: element.dataset.calendarResourceLabel,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(event);
    if (!isMovable || event.button !== 0 || event.defaultPrevented) return;

    const element = event.currentTarget;
    const { pointerId } = event;
    const origin = {
      x: event.clientX,
      y: event.clientY,
    };
    // Where inside the event the user grabbed it, so it doesn't jump under the cursor.
    const grabMinutes =
      column && timeGrid && start
        ? ((event.clientY - element.getBoundingClientRect().top) /
            timeGrid.hourHeight) *
          60
        : 0;

    let started = false;
    let target: CalendarDropTarget | null = null;

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleEscape, true);
      element.style.pointerEvents = "";
      if (element.hasPointerCapture(pointerId))
        element.releasePointerCapture(pointerId);
      move.setDrag(null);
      if (!started) return;
      draggedRef.current = true;
      if (commit && target) applyMove(target);
    };

    const handleMove = (pointer: PointerEvent) => {
      if (
        !started &&
        Math.abs(pointer.clientX - origin.x) < 4 &&
        Math.abs(pointer.clientY - origin.y) < 4
      ) {
        return;
      }
      // Hidden from hit-testing so `elementFromPoint` reports the slot below, not the event itself.
      element.style.pointerEvents = "none";
      started = true;
      target = resolveTarget(pointer.clientX, pointer.clientY, grabMinutes);
      move.setDrag({
        duration: duration || 60,
        id: eventId as string,
        target,
      });
    };
    const handleUp = () => finish(true);
    const handleCancel = () => finish(false);
    const handleEscape = (key: KeyboardEvent) => {
      if (key.key !== "Escape") return;
      key.preventDefault();
      finish(false);
    };

    element.setPointerCapture(pointerId);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleEscape, true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;

    const verticalStep =
      event.key === "ArrowDown"
        ? move.snapMinutes
        : event.key === "ArrowUp"
          ? -move.snapMinutes
          : 0;

    // Modifier + ↑ ↓ stretches the event instead of moving it: Shift the end edge, Alt the start edge.
    if (verticalStep !== 0 && (event.shiftKey || event.altKey) && isResizable) {
      event.preventDefault();
      const edge = event.altKey ? "start" : "end";
      const startMinutes = minutesOfDay(start as Date);
      applyResize(
        clampResize(
          edge,
          edge === "end"
            ? startMinutes + duration + verticalStep
            : startMinutes + verticalStep,
        ),
        edge,
      );
      return;
    }

    if (!isMovable || event.altKey || event.shiftKey) return;

    const dayStep =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const inTimeGrid = Boolean(column && timeGrid && start);
    const minuteStep = inTimeGrid
      ? event.key === "ArrowDown"
        ? move.snapMinutes
        : event.key === "ArrowUp"
          ? -move.snapMinutes
          : 0
      : 0;
    if (dayStep === 0 && minuteStep === 0) return;
    event.preventDefault();

    applyMove({
      date: addDays(
        column?.date ?? (start ? startOfDay(start) : today),
        dayStep,
      ),
      minutes:
        inTimeGrid && start && timeGrid
          ? Math.min(
              Math.max(
                minutesOfDay(start) + minuteStep,
                timeGrid.startHour * 60,
              ),
              timeGrid.endHour * 60 - duration,
            )
          : null,
      resourceId: row?.resourceId,
      resourceLabel: row?.label,
    });
  };

  const hints = [
    isMovable ? move.descriptionId : null,
    isResizable ? move.resizeDescriptionId : null,
  ].filter(Boolean);
  const describedBy =
    ariaDescribedBy ?? (hints.length > 0 ? hints.join(" ") : undefined);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  let placement: React.CSSProperties | undefined;
  let compact = false;

  if (column && timeGrid && effectiveStart) {
    const { endHour, hourHeight, startHour } = timeGrid;
    const dayStart = startOfDay(column.date).getTime();
    const total = (endHour - startHour) * 60;
    const from =
      (effectiveStart.getTime() - dayStart) / 60_000 - startHour * 60;
    const to = effectiveEnd
      ? (effectiveEnd.getTime() - dayStart) / 60_000 - startHour * 60
      : from + 60;
    const clampedFrom = Math.min(Math.max(from, 0), total);
    const clampedTo = Math.min(Math.max(to, 0), total);

    // Entirely outside the visible hour range.
    if (clampedTo <= clampedFrom) return null;

    const height = Math.max(
      ((clampedTo - clampedFrom) / 60) * hourHeight - 2,
      MIN_EVENT_HEIGHT,
    );
    compact = height < 44;
    placement = {
      height,
      left: `calc(${(lane / lanes) * 100}% + 2px)`,
      top: (clampedFrom / 60) * hourHeight + 1,
      width: `calc(${100 / lanes}% - 4px)`,
    };
  }

  return (
    <EventContext.Provider value={eventValue}>
      <button
        aria-describedby={describedBy}
        data-dragging={isDragging ? "" : undefined}
        data-tone={tone}
        type={type}
        {...props}
        className={cn(
          calendarEventVariants({
            tone,
          }),
          placement ? "absolute" : "w-full",
          compact ? "flex-row items-center gap-2" : "flex-col gap-0.5",
          isMovable &&
            "cursor-grab touch-none select-none active:cursor-grabbing",
          isDragging && "opacity-40",
          className,
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        style={{
          ...placement,
          ...style,
        }}
      >
        {children}
        {isResizable && placement ? (
          <>
            <CalendarEventResizeGrip
              edge="start"
              onPointerDown={handleResizePointerDown("start")}
            />
            <CalendarEventResizeGrip
              edge="end"
              onPointerDown={handleResizePointerDown("end")}
            />
          </>
        ) : null}
      </button>
    </EventContext.Provider>
  );
}

export interface CalendarEventTitleProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

/** Title line of an event. Truncates instead of wrapping. */
function CalendarEventTitle({ className, ...props }: CalendarEventTitleProps) {
  return (
    <span
      {...props}
      className={cn("truncate font-medium", className)}
    />
  );
}

export interface CalendarEventTimeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Show the range (`9:00 – 10:30`) instead of only the start time.
   * @default false
   */
  showEnd?: boolean;
}

/** Time line of an event, formatted from the parent event's `start` (and `end`). Pass `children` to replace it. */
function CalendarEventTime({
  children,
  className,
  showEnd = false,
  ...props
}: CalendarEventTimeProps) {
  const { formatters } = useCalendar();
  const event = React.useContext(EventContext);

  const text =
    children ??
    (event?.start
      ? showEnd && event.end
        ? formatters.time.formatRange(event.start, event.end)
        : formatters.time.format(event.start)
      : null);

  return (
    <span
      {...props}
      className={cn(
        "truncate text-foreground-secondary group-data-[tone=solid]/event:text-background/70",
        className,
      )}
    >
      {text}
    </span>
  );
}

/**
 * Compound calendar for showing tasks by date. It has two interchangeable bodies that share the same header,
 * navigation and state:
 * - `Calendar.TimeGrid`: date columns × hour rows (Google Calendar style).
 * - `Calendar.ResourceGrid`: date columns × person rows (who does what, and when).
 *
 * The day columns / cells (`TimeColumn`, `ResourceCell`) and the `Event`s are children, so you can render
 * anything inside them.
 *
 * @example
 * ```tsx
 * <Calendar>
 *   <Calendar.Header>
 *     <Calendar.Title />
 *     <Calendar.Toolbar>
 *       <Calendar.Previous />
 *       <Calendar.Today />
 *       <Calendar.Next />
 *       <Calendar.ViewSwitch />
 *     </Calendar.Toolbar>
 *   </Calendar.Header>
 *   <Calendar.Grid>
 *     <Calendar.DayHeader />
 *     <Calendar.TimeGrid startHour={8} endHour={18}>
 *       {(days) =>
 *         days.map((day) => (
 *           <Calendar.TimeColumn key={day.getTime()} date={day}>
 *             <Calendar.Event start={start} end={end}>
 *               <Calendar.EventTitle>Design sync</Calendar.EventTitle>
 *               <Calendar.EventTime />
 *             </Calendar.Event>
 *           </Calendar.TimeColumn>
 *         ))
 *       }
 *     </Calendar.TimeGrid>
 *   </Calendar.Grid>
 * </Calendar>
 * ```
 */
export const Calendar = Object.assign(CalendarRoot, {
  DateBadge: CalendarDateBadge,
  DayHeader: CalendarDayHeader,
  Description: CalendarDescription,
  Event: CalendarEvent,
  EventTime: CalendarEventTime,
  EventTitle: CalendarEventTitle,
  Grid: CalendarGrid,
  Header: CalendarHeader,
  Next: CalendarNext,
  NowIndicator: CalendarNowIndicator,
  Previous: CalendarPrevious,
  ResourceCell: CalendarResourceCell,
  ResourceGrid: CalendarResourceGrid,
  ResourceLabel: CalendarResourceLabel,
  ResourceRow: CalendarResourceRow,
  TimeColumn: CalendarTimeColumn,
  TimeGrid: CalendarTimeGrid,
  Title: CalendarTitle,
  Today: CalendarToday,
  Toolbar: CalendarToolbar,
  ViewSwitch: CalendarViewSwitch,
});
