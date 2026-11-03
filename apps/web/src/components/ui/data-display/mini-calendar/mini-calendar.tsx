"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Icon } from "../../foundations/icon/icon";
import { cn } from "../../utils/tailwind/cn";

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function formatDayParts(date: Date, locale: string) {
  return {
    day: new Intl.DateTimeFormat(locale, {
      day: "numeric",
    }).format(date),
    month: new Intl.DateTimeFormat(locale, {
      month: "short",
    }).format(date),
  };
}

function getConsecutiveDays(start: Date, count: number): Date[] {
  return Array.from(
    {
      length: count,
    },
    (_, index) => addDays(start, index),
  );
}

/** Texts rendered by `MiniCalendar`'s subcomponents. Pass `lang` to override any of them. */
export interface MiniCalendarLang {
  /** Accessible label for the "previous days" navigation button. */
  previousDays: string;
  /** Accessible label for the "next days" navigation button. */
  nextDays: string;
}

/** English defaults for `MiniCalendarLang`. */
export const defaultMiniCalendarLang: MiniCalendarLang = {
  nextDays: "Next days",
  previousDays: "Previous days",
};

interface MiniCalendarContextValue {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  startDate: Date;
  onNavigate: (direction: "prev" | "next") => void;
  days: number;
  locale: string;
  lang: MiniCalendarLang;
}

const MiniCalendarContext =
  React.createContext<MiniCalendarContextValue | null>(null);

function useMiniCalendarContext() {
  const context = React.useContext(MiniCalendarContext);
  if (!context) {
    throw new Error(
      "MiniCalendar subcomponents must be used within <MiniCalendar>.",
    );
  }
  return context;
}

export interface MiniCalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "lang"> {
  /** Selected date, for controlled usage. */
  value?: Date;
  /** Initial selected date, for uncontrolled usage. */
  defaultValue?: Date;
  onValueChange?: (date: Date | undefined) => void;
  /** First visible date, for controlled usage. */
  startDate?: Date;
  /** Initial first visible date, for uncontrolled usage. @default today */
  defaultStartDate?: Date;
  onStartDateChange?: (date: Date | undefined) => void;
  /**
   * Consecutive days shown at once, and stepped by on navigation.
   * @default 5
   */
  days?: number;
  /**
   * BCP 47 locale used to format each day's weekday/month.
   * @default "en-US"
   */
  locale?: string;
  /**
   * Texts rendered by this component's subcomponents. Merges over English defaults.
   * @default defaultMiniCalendarLang
   */
  lang?: Partial<MiniCalendarLang>;
}

/**
 * Compound mini calendar — a compact horizontal strip of consecutive days
 * for booking-style date pickers, adapted from kibo-ui's `MiniCalendar` to
 * this library's own tokens/conventions: hand-rolled date math instead of
 * `date-fns` (the same call `DatePicker` already makes) and a manual
 * controlled/uncontrolled pattern instead of
 * `@radix-ui/react-use-controllable-state`, so it adds zero new
 * dependencies.
 * @example
 * ```tsx
 * <MiniCalendar days={5} onValueChange={setDate} value={date}>
 *   <MiniCalendar.Navigation direction="prev" />
 *   <MiniCalendar.Days>
 *     {(date) => <MiniCalendar.Day date={date} key={date.toISOString()} />}
 *   </MiniCalendar.Days>
 *   <MiniCalendar.Navigation direction="next" />
 * </MiniCalendar>
 * ```
 */
function MiniCalendarRoot({
  value,
  defaultValue,
  onValueChange,
  startDate: controlledStartDate,
  defaultStartDate,
  onStartDateChange,
  days = 5,
  locale = "en-US",
  lang,
  className,
  children,
  ...props
}: MiniCalendarProps) {
  const resolvedLang = { ...defaultMiniCalendarLang, ...lang };
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const isValueControlled = value !== undefined;
  const selectedDate = isValueControlled ? value : uncontrolledValue;

  const [uncontrolledStartDate, setUncontrolledStartDate] =
    React.useState<Date>(() => defaultStartDate ?? new Date());
  const isStartDateControlled = controlledStartDate !== undefined;
  const startDate = isStartDateControlled
    ? controlledStartDate
    : uncontrolledStartDate;

  const handleDateSelect = React.useCallback(
    (date: Date) => {
      if (!isValueControlled) setUncontrolledValue(date);
      onValueChange?.(date);
    },
    [
      isValueControlled,
      onValueChange,
    ],
  );

  const handleNavigate = React.useCallback(
    (direction: "prev" | "next") => {
      const next = addDays(startDate, direction === "next" ? days : -days);
      if (!isStartDateControlled) setUncontrolledStartDate(next);
      onStartDateChange?.(next);
    },
    [
      startDate,
      days,
      isStartDateControlled,
      onStartDateChange,
    ],
  );

  const contextValue = React.useMemo<MiniCalendarContextValue>(
    () => ({
      days,
      lang: resolvedLang,
      locale,
      onDateSelect: handleDateSelect,
      onNavigate: handleNavigate,
      selectedDate: selectedDate ?? null,
      startDate,
    }),
    [
      days,
      resolvedLang,
      locale,
      handleDateSelect,
      handleNavigate,
      selectedDate,
      startDate,
    ],
  );

  return (
    <MiniCalendarContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex w-fit items-center gap-2 rounded-lg border border-border bg-background p-2",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </MiniCalendarContext.Provider>
  );
}

export interface MiniCalendarNavigationProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  direction: "prev" | "next";
}

/** Steps the visible day range backward/forward by `days`. */
function MiniCalendarNavigation({
  direction,
  className,
  onClick,
  children,
  ...props
}: MiniCalendarNavigationProps) {
  const { onNavigate, lang } = useMiniCalendarContext();
  const DirectionIcon = direction === "prev" ? ChevronLeft : ChevronRight;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onNavigate(direction);
    onClick?.(event);
  };

  return (
    <button
      aria-label={direction === "prev" ? lang.previousDays : lang.nextDays}
      className={cn(
        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-in-out hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        className,
      )}
      onClick={handleClick}
      type="button"
      {...props}
    >
      {children ?? (
        <Icon
          icon={DirectionIcon}
          size="sm"
        />
      )}
    </button>
  );
}

export interface MiniCalendarDaysProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Render prop, called once per visible date — lets the consumer customize/key each `MiniCalendar.Day`. */
  children: (date: Date) => React.ReactNode;
}

/** Lays out the currently visible date range. */
function MiniCalendarDays({
  className,
  children,
  ...props
}: MiniCalendarDaysProps) {
  const { startDate, days } = useMiniCalendarContext();
  const dates = React.useMemo(
    () => getConsecutiveDays(startDate, days),
    [
      startDate,
      days,
    ],
  );

  return (
    <div
      className={cn("flex flex-1 items-center gap-1", className)}
      {...props}
    >
      {dates.map((date) => children(date))}
    </div>
  );
}

export interface MiniCalendarDayProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  date: Date;
}

/** One selectable day. Highlights today (muted background) and the selected date (inverted ink, matching `Button`'s primary treatment). */
function MiniCalendarDay({ date, className, ...props }: MiniCalendarDayProps) {
  const { selectedDate, onDateSelect, locale } = useMiniCalendarContext();
  const { month, day } = formatDayParts(date, locale);
  const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
  const isTodayDate = isToday(date);

  return (
    <button
      aria-current={isTodayDate ? "date" : undefined}
      aria-pressed={isSelected}
      className={cn(
        "flex h-auto min-w-12 shrink-0 flex-col items-center gap-0 rounded-md p-2 transition-colors duration-150 ease-in-out",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        isSelected
          ? "bg-foreground text-background"
          : "text-foreground hover:bg-muted",
        isTodayDate && !isSelected && "bg-muted",
        className,
      )}
      onClick={() => onDateSelect(date)}
      type="button"
      {...props}
    >
      <span
        className={cn(
          "font-primary text-[10px] font-medium",
          isSelected ? "text-background/70" : "text-muted-foreground",
        )}
      >
        {month}
      </span>
      <span className="font-primary text-sm font-semibold">{day}</span>
    </button>
  );
}

export const MiniCalendar = Object.assign(MiniCalendarRoot, {
  Day: MiniCalendarDay,
  Days: MiniCalendarDays,
  Navigation: MiniCalendarNavigation,
});
