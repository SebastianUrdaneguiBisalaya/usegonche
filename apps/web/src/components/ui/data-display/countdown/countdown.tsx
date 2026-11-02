"use client";

import gsap from "gsap";
import * as React from "react";
import { useGsapContext } from "../../hooks/useGsapContext";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { cn } from "../../utils/tailwind/cn";

/** One of the time units a countdown can display. */
export type CountdownUnit = "months" | "days" | "hours" | "minutes" | "seconds";

/** Remaining amount per unit, for the units the countdown was asked to show. */
export type CountdownValues = Partial<Record<CountdownUnit, number>>;

/** Largest → smallest. The display always follows this order, whatever order `units` was given in. */
const UNIT_ORDER: readonly CountdownUnit[] = [
  "months",
  "days",
  "hours",
  "minutes",
  "seconds",
];

const MS_PER_UNIT = {
  days: 86_400_000,
  hours: 3_600_000,
  minutes: 60_000,
  seconds: 1_000,
} as const satisfies Record<Exclude<CountdownUnit, "months">, number>;

/** English defaults for `Countdown.Root`'s `lang` prop. */
export const defaultCountdownLang: Record<CountdownUnit, string> = {
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  months: "Months",
  seconds: "Seconds",
};

/** How often the remaining time is recomputed. Faster than 1s so the seconds digit turns over on time. */
const TICK_MS = 250;

/**
 * Adds whole calendar months, clamping the day to the target month's length (Jan 31 + 1 month → Feb 28/29)
 * so month arithmetic never rolls over into the following month the way `setMonth` alone does.
 */
function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + months);

  const daysInTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, daysInTargetMonth));

  return next;
}

/**
 * Whole calendar months between two dates — never a fixed "30 days" approximation, so a countdown started on
 * Jan 1 towards Mar 1 reads "2 months, 0 days" instead of "1 month, 29 days".
 */
function monthsBetween(from: Date, to: Date): number {
  const roughMonths =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (roughMonths <= 0) return 0;

  // The rough figure ignores the day-of-month, so it can overshoot by one (Jan 31 → Feb 1 looks like 1 month).
  return addMonths(from, roughMonths).getTime() > to.getTime()
    ? roughMonths - 1
    : roughMonths;
}

export interface CountdownSnapshot {
  /** Remaining amount for each requested unit, already carried over from the larger units. */
  readonly values: CountdownValues;
  /** `true` once the target moment has been reached or passed. */
  readonly complete: boolean;
}

/**
 * Splits the time left until `targetTime` across `units`, largest unit first.
 *
 * Only the requested units are filled in: the largest one absorbs everything above it (with `units: ["hours"]`,
 * `hours` is the *total* hours left, not the hours-within-the-day), and anything below the smallest requested
 * unit is truncated rather than rounded — a countdown showing only minutes reads `0` for the last 59 seconds,
 * never `1`. Exported so the carry-over logic can be unit-tested without mounting the component.
 */
export function computeCountdown(
  targetTime: number,
  now: number,
  units: readonly CountdownUnit[],
): CountdownSnapshot {
  const ordered = UNIT_ORDER.filter((unit) => units.includes(unit));
  const values: CountdownValues = {};

  if (!Number.isFinite(targetTime) || targetTime - now <= 0) {
    for (const unit of ordered) values[unit] = 0;
    return {
      complete: true,
      values,
    };
  }

  let remainingMs = targetTime - now;

  if (ordered[0] === "months") {
    const months = monthsBetween(new Date(now), new Date(targetTime));
    values.months = months;
    remainingMs = targetTime - addMonths(new Date(now), months).getTime();
  }

  for (const unit of ordered) {
    if (unit === "months") continue;
    const msPerUnit = MS_PER_UNIT[unit];
    const amount = Math.floor(remainingMs / msPerUnit);
    values[unit] = amount;
    remainingMs -= amount * msPerUnit;
  }

  return {
    complete: false,
    values,
  };
}

function sameSnapshot(
  a: CountdownSnapshot,
  b: CountdownSnapshot,
  units: readonly CountdownUnit[],
): boolean {
  if (a.complete !== b.complete) return false;
  return units.every((unit) => a.values[unit] === b.values[unit]);
}

function toTime(target: Date | string | number): number {
  if (target instanceof Date) return target.getTime();
  if (typeof target === "number") return target;
  return new Date(target).getTime();
}

type CountdownSize = "sm" | "md" | "lg";

const DIGIT_SIZE: Record<CountdownSize, string> = {
  lg: "text-6xl sm:text-8xl",
  md: "text-5xl sm:text-6xl",
  sm: "text-3xl",
};

const LABEL_SIZE: Record<CountdownSize, string> = {
  lg: "text-xs sm:text-sm",
  md: "text-xs",
  sm: "text-[0.6875rem]",
};

const BOX_SIZE: Record<CountdownSize, string> = {
  lg: "px-5 py-4 sm:px-8 sm:py-6",
  md: "px-4 py-3 sm:px-6 sm:py-4",
  sm: "px-3 py-2",
};

const UNIT_GAP: Record<CountdownSize, string> = {
  lg: "gap-4 sm:gap-6",
  md: "gap-3 sm:gap-4",
  sm: "gap-2 sm:gap-3",
};

interface CountdownContextValue {
  readonly values: CountdownValues;
  readonly complete: boolean;
  readonly units: readonly CountdownUnit[];
  readonly lang: Record<CountdownUnit, string>;
  readonly size: CountdownSize;
  readonly variant: "plain" | "boxed";
  readonly minDigits: number;
  readonly animated: boolean;
}

const CountdownContext = React.createContext<CountdownContextValue | null>(
  null,
);

function useCountdownContext() {
  const context = React.useContext(CountdownContext);
  if (!context) {
    throw new Error(
      "Countdown subcomponents must be used within <Countdown.Root>.",
    );
  }
  return context;
}

export interface CountdownRootProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "lang"> {
  /** Moment being counted down to — a `Date`, an epoch in milliseconds, or any string `new Date()` parses (e.g. `"2027-01-01T00:00:00Z"`). */
  target: Date | string | number;
  /**
   * Units to show, largest first, carried over from one another. Any subset works: `["days", "hours"]` makes
   * `days` the total days left, `["months", "days", "hours"]` drops minutes and seconds entirely.
   * @default ["months", "days", "hours", "minutes", "seconds"]
   */
  units?: readonly CountdownUnit[];
  /**
   * Type scale of the digits and their labels.
   * @default "lg"
   */
  size?: CountdownSize;
  /**
   * `"plain"` sets the digits straight on the page; `"boxed"` puts each unit on its own bordered surface.
   * @default "plain"
   */
  variant?: "plain" | "boxed";
  /**
   * Unit labels, for translating or shortening them (e.g. `{ seconds: "Sec" }`). Merges over English defaults.
   * @default defaultCountdownLang
   */
  lang?: Partial<Record<CountdownUnit, string>>;
  /**
   * Minimum digits per unit; shorter values are zero-padded, longer ones keep every digit.
   * @default 2
   */
  minDigits?: number;
  /**
   * Slides each digit up as it turns over. Forced off under `prefers-reduced-motion: reduce`.
   * @default true
   */
  animated?: boolean;
  /** Called once, on the tick that reaches the target. Not called if the target was already in the past on mount. */
  onComplete?: () => void;
  children: React.ReactNode;
}

/**
 * Compound event countdown — the oversized timer a landing page or launch announcement puts above the fold —
 * holding the ticking state and sharing it with its pieces through Context.
 *
 * Which units it shows is up to the composition: pass `units` and every piece follows, so the same component
 * covers a full `months → seconds` readout and a short `days / hours` one. Digits are monospaced
 * (`font-secondary`) on purpose: it's a numeric readout, and fixed-width glyphs keep the layout from jittering
 * as values turn over, while labels stay in `font-primary`.
 *
 * Recomputes from `Date.now()` on every tick instead of decrementing a counter, so it can't drift while the tab
 * is throttled or asleep, and only re-renders when a displayed value actually changes.
 *
 * Accessibility: the element is a `role="timer"` with `aria-live="off"` — a live region would make a screen
 * reader read the whole timer out loud every second. Each `Countdown.Unit` carries a visually hidden
 * "`value` `label`" pair, so the remaining time is readable on demand while the animated digits themselves are
 * `aria-hidden`.
 *
 * @example
 * ```tsx
 * <Countdown.Root target="2027-01-01T00:00:00Z" units={["days", "hours", "minutes"]} variant="boxed">
 *   <Countdown.Label>Faltan para el lanzamiento</Countdown.Label>
 *   <Countdown.Units separator=":" />
 *   <Countdown.Complete>¡Ya estamos en vivo!</Countdown.Complete>
 * </Countdown.Root>
 * ```
 */
function CountdownRoot({
  target,
  units = UNIT_ORDER,
  size = "lg",
  variant = "plain",
  lang,
  minDigits = 2,
  animated = true,
  onComplete,
  className,
  children,
  ...props
}: CountdownRootProps) {
  const reducedMotion = usePrefersReducedMotion();
  const targetTime = React.useMemo(
    () => toTime(target),
    [
      target,
    ],
  );

  // Normalised (ordered, de-duplicated) and identity-stable, so it's safe as an effect dependency even when the
  // caller passes a fresh array literal on every render.
  const orderedUnits = React.useMemo(
    () => UNIT_ORDER.filter((unit) => units.includes(unit)),
    [
      units,
    ],
  );
  const unitsKey = orderedUnits.join(",");

  const [snapshot, setSnapshot] = React.useState<CountdownSnapshot>(() =>
    computeCountdown(targetTime, Date.now(), orderedUnits),
  );

  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    // `unitsKey` is the ordered unit list already, so it can be read back instead of closing over the array.
    const currentUnits = unitsKey
      ? (unitsKey.split(",") as CountdownUnit[])
      : [];
    let settled = computeCountdown(targetTime, Date.now(), currentUnits);
    setSnapshot(settled);

    if (settled.complete) return;

    const interval = window.setInterval(() => {
      const next = computeCountdown(targetTime, Date.now(), currentUnits);
      if (sameSnapshot(next, settled, currentUnits)) return;
      settled = next;
      setSnapshot(next);

      if (next.complete) {
        window.clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [
    targetTime,
    unitsKey,
  ]);

  const contextValue = React.useMemo<CountdownContextValue>(
    () => ({
      animated: animated && !reducedMotion,
      complete: snapshot.complete,
      lang: {
        ...defaultCountdownLang,
        ...lang,
      },
      minDigits,
      size,
      units: orderedUnits,
      values: snapshot.values,
      variant,
    }),
    [
      animated,
      reducedMotion,
      snapshot,
      lang,
      minDigits,
      size,
      orderedUnits,
      variant,
    ],
  );

  return (
    <CountdownContext.Provider value={contextValue}>
      <div
        aria-live="off"
        className={cn(
          "flex w-fit flex-col items-center gap-4 font-primary text-foreground",
          className,
        )}
        role="timer"
        {...props}
      >
        {children}
      </div>
    </CountdownContext.Provider>
  );
}

export interface CountdownLabelProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

/** Eyebrow copy above (or below) the digits — what the countdown is counting down to. */
function Label({ className, ...props }: CountdownLabelProps) {
  return (
    <p
      className={cn(
        "text-center font-primary text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface CountdownUnitsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Drawn between consecutive units, e.g. `":"`. Omit it to leave only the gap. */
  separator?: React.ReactNode;
}

/**
 * Renders one `Countdown.Unit` per unit in `units`, in order, with an optional separator between them — the
 * shortcut for the common case. Compose `Countdown.Unit` by hand instead when the units need individual
 * styling or a custom arrangement.
 */
function Units({ separator, className, ...props }: CountdownUnitsProps) {
  const { units, size } = useCountdownContext();

  return (
    <div
      className={cn("flex items-start", UNIT_GAP[size], className)}
      {...props}
    >
      {units.map((unit, index) => (
        <React.Fragment key={unit}>
          {index > 0 && separator !== undefined && (
            <Separator>{separator}</Separator>
          )}
          <Unit unit={unit} />
        </React.Fragment>
      ))}
    </div>
  );
}

export interface CountdownSeparatorProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Separator glyph.
   * @default ":"
   */
  children?: React.ReactNode;
}

/** Decorative glyph between two units. Hidden from assistive tech, which reads each unit's own label instead. */
function Separator({
  className,
  children = ":",
  ...props
}: CountdownSeparatorProps) {
  const { size } = useCountdownContext();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "select-none font-secondary leading-none text-foreground-tertiary",
        DIGIT_SIZE[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export interface CountdownUnitProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Which unit to show. Reads `0` if it isn't among the root's `units`. */
  unit: CountdownUnit;
  /** Overrides the label under the digits for this unit only; defaults to the root's `lang` entry. */
  label?: React.ReactNode;
}

/** A single unit of the countdown: its zero-padded digits plus the unit's label. */
function Unit({ unit, label, className, ...props }: CountdownUnitProps) {
  const { values, lang, size, variant, minDigits, animated } =
    useCountdownContext();

  const value = values[unit] ?? 0;
  const text = lang[unit];
  const digits = String(value).padStart(minDigits, "0").split("");

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        variant === "boxed" &&
          cn("rounded-md border border-border bg-muted", BOX_SIZE[size]),
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex font-secondary font-medium leading-none tracking-tight tabular-nums",
          DIGIT_SIZE[size],
        )}
      >
        {digits.map((digit, index) => (
          <Digit
            animated={animated}
            digit={digit}
            // The digit's position is its identity — keying by value would remount (and re-animate) every
            // slot each time the number changes.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional slot, see above.
            key={index}
          />
        ))}
      </span>
      <span
        className={cn(
          "font-primary uppercase tracking-[0.12em] text-muted-foreground",
          LABEL_SIZE[size],
        )}
      >
        {label ?? text}
      </span>
      <span className="sr-only">{`${value} ${text}`}</span>
    </div>
  );
}

/**
 * One digit slot. Slides its glyph up into a clipped box every time the character changes, which is what makes
 * the timer read as ticking rather than silently swapping numbers. `1ch` wide against the monospaced face, so
 * the row's width never depends on which digits are showing.
 */
function Digit({ digit, animated }: { digit: string; animated: boolean }) {
  const scope = useGsapContext<HTMLSpanElement>(
    (root) => {
      gsap.fromTo(
        root,
        {
          opacity: 0,
          yPercent: 100,
        },
        {
          duration: 0.45,
          ease: "power3.out",
          opacity: 1,
          yPercent: 0,
        },
      );
    },
    [
      digit,
    ],
    {
      disabled: !animated,
    },
  );

  return (
    <span className="inline-block w-[1ch] overflow-hidden text-center">
      <span
        className="inline-block"
        ref={scope}
      >
        {digit}
      </span>
    </span>
  );
}

export interface CountdownStateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Renders its children only once the target moment has been reached — the "we're live" message. */
function Complete({ className, ...props }: CountdownStateProps) {
  const { complete } = useCountdownContext();
  if (!complete) return null;

  return (
    <div
      className={cn(
        "font-primary text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Renders its children only while time is still left — the mirror image of `Countdown.Complete`. */
function Running({ className, ...props }: CountdownStateProps) {
  const { complete } = useCountdownContext();
  if (complete) return null;

  return (
    <div
      className={cn("font-primary text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export const Countdown = {
  Complete,
  Label,
  Root: CountdownRoot,
  Running,
  Separator,
  Unit,
  Units,
};
