"use client";

import { Check, ListChecks, Minus } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "../../actions-controls/button/button";
import { Progress } from "../../data-display/progress/progress";
import { Icon } from "../../foundations/icon/icon";
import { Typography } from "../../foundations/typography/typography";
import { cn } from "../../utils/tailwind/cn";

export type OnboardingTimelineStepStatus = "completed" | "active" | "upcoming";

interface OnboardingTimelineContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  /** 0-indexed current step, shared with `Steps` (status) and `Trigger` (progress ring). */
  readonly value: number;
  /** Total step count, shared with `Steps` (status) and `Trigger` (progress ring). */
  readonly totalSteps: number;
  readonly titleId: string;
  readonly panelId: string;
}

const OnboardingTimelineContext =
  React.createContext<OnboardingTimelineContextValue | null>(null);

function useOnboardingTimelineContext() {
  const context = React.useContext(OnboardingTimelineContext);
  if (!context) {
    throw new Error(
      "OnboardingTimeline subcomponents must be used within <OnboardingTimeline.Root>.",
    );
  }
  return context;
}

export interface OnboardingTimelineRootProps {
  /** `Trigger` and `Panel` — only the one matching the current open state renders. */
  children: React.ReactNode;
  /**
   * Whether the widget starts expanded (uncontrolled usage). Ignored once `open` is passed.
   * @default false
   */
  defaultOpen?: boolean;
  /** Open state for controlled usage. */
  open?: boolean;
  /** Called whenever the open state changes, controlled or not. */
  onOpenChange?: (open: boolean) => void;
  /** 0-indexed current step. Steps before it are "completed", this one is "active", later ones are "upcoming". */
  value: number;
  /** Total number of steps, used to compute the completion ring on the collapsed `Trigger`. */
  totalSteps: number;
  /** Additional classes for the fixed bottom-right wrapper. */
  className?: string;
}

/**
 * Root of the compound floating onboarding widget — a `position: fixed`,
 * bottom-right stack that swaps between a collapsed `Trigger` (a round icon
 * button with a completion ring) and an expanded `Panel` (a vertical
 * timeline of onboarding steps). Owns open/closed state and the shared
 * step/progress values, portaled to `document.body` so it always sits above
 * page content regardless of ancestor `overflow`/`transform`. Closes on
 * Escape while expanded.
 * @example
 * ```tsx
 * <OnboardingTimeline.Root defaultOpen totalSteps={3} value={1}>
 *   <OnboardingTimeline.Trigger />
 *   <OnboardingTimeline.Panel>
 *     <OnboardingTimeline.Header>
 *       <div className="flex flex-col gap-0.5">
 *         <OnboardingTimeline.Title>Get set up</OnboardingTimeline.Title>
 *         <OnboardingTimeline.Description>3 quick steps</OnboardingTimeline.Description>
 *       </div>
 *       <OnboardingTimeline.Close />
 *     </OnboardingTimeline.Header>
 *     <OnboardingTimeline.Steps>
 *       <OnboardingTimeline.Step title="Create your account" />
 *       <OnboardingTimeline.Step title="Invite your team" description="Optional, you can skip this." />
 *       <OnboardingTimeline.Step title="Connect your data" />
 *     </OnboardingTimeline.Steps>
 *   </OnboardingTimeline.Panel>
 * </OnboardingTimeline.Root>
 * ```
 */
function OnboardingTimelineRoot({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  value,
  totalSteps,
  className,
}: OnboardingTimelineRootProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const titleId = React.useId();
  const panelId = React.useId();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [
      isControlled,
      onOpenChange,
    ],
  );

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    setOpen,
  ]);

  const contextValue = React.useMemo(
    () => ({
      open,
      panelId,
      setOpen,
      titleId,
      totalSteps,
      value,
    }),
    [
      open,
      panelId,
      setOpen,
      titleId,
      totalSteps,
      value,
    ],
  );

  if (!mounted) return null;

  return (
    <OnboardingTimelineContext.Provider value={contextValue}>
      {createPortal(
        <div
          className={cn(
            "fixed right-6 bottom-6 z-40 flex flex-col items-end",
            className,
          )}
        >
          {children}
        </div>,
        document.body,
      )}
    </OnboardingTimelineContext.Provider>
  );
}

export interface OnboardingTimelineTriggerProps {
  /** Accessible label for the collapsed button. */
  "aria-label"?: string;
  className?: string;
}

/** Collapsed state: a round icon button ringed by a `Progress` circle showing step completion. Renders only while closed. */
function OnboardingTimelineTrigger({
  "aria-label": ariaLabel = "Open onboarding checklist",
  className,
}: OnboardingTimelineTriggerProps) {
  const { open, setOpen, value, totalSteps, panelId } =
    useOnboardingTimelineContext();

  if (open) return null;

  const percent = totalSteps > 0 ? (value / totalSteps) * 100 : 0;

  return (
    <div
      className={cn(
        "relative flex size-14 animate-fade-scale-in items-center justify-center motion-reduce:animate-none",
        className,
      )}
    >
      <Progress
        className="pointer-events-none absolute inset-0"
        max={100}
        size={56}
        strokeWidth={3}
        value={percent}
        variant="circle"
      >
        <Progress.Indicator />
      </Progress>
      <Button
        aria-controls={panelId}
        aria-expanded={false}
        aria-label={ariaLabel}
        className="relative size-11 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        size="icon"
      >
        <Button.Icon
          aria-label={ariaLabel}
          icon={ListChecks}
        />
      </Button>
    </div>
  );
}

export interface OnboardingTimelinePanelProps {
  children: React.ReactNode;
  className?: string;
}

/** Expanded state: bordered card holding `Header`, `Steps`, and an optional `Footer`. Renders only while open. */
function OnboardingTimelinePanel({
  children,
  className,
}: OnboardingTimelinePanelProps) {
  const { open, titleId, panelId } = useOnboardingTimelineContext();

  if (!open) return null;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex max-h-128 w-80 origin-bottom-right animate-fade-scale-in flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg motion-reduce:animate-none sm:w-96",
        className,
      )}
      id={panelId}
    >
      {children}
    </section>
  );
}

export interface OnboardingTimelineHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Top row of the panel: `Title`/`Description` block plus `Close`. */
function OnboardingTimelineHeader({
  className,
  ...props
}: OnboardingTimelineHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 border-border border-b px-4 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export interface OnboardingTimelineTitleProps
  extends React.ComponentProps<typeof Typography.H3> {}

/** Panel heading. Renders `Typography.H3`. Also serves as the panel's `aria-labelledby` target. */
function OnboardingTimelineTitle({
  className,
  ...props
}: OnboardingTimelineTitleProps) {
  const { titleId } = useOnboardingTimelineContext();
  return (
    <Typography.H3
      className={cn("text-base", className)}
      id={titleId}
      {...props}
    />
  );
}

export interface OnboardingTimelineDescriptionProps
  extends React.ComponentProps<typeof Typography.Muted> {}

/** Supporting copy under `Title`. Renders `Typography.Muted`. */
function OnboardingTimelineDescription({
  className,
  ...props
}: OnboardingTimelineDescriptionProps) {
  return (
    <Typography.Muted
      className={cn("text-xs", className)}
      {...props}
    />
  );
}

export interface OnboardingTimelineCloseProps {
  /** Accessible label for the minimize button. */
  "aria-label"?: string;
  className?: string;
}

/** Icon button that minimizes the panel back to the collapsed `Trigger`. */
function OnboardingTimelineClose({
  "aria-label": ariaLabel = "Minimize onboarding checklist",
  className,
}: OnboardingTimelineCloseProps) {
  const { setOpen } = useOnboardingTimelineContext();
  return (
    <Button
      aria-label={ariaLabel}
      className={cn("-mt-1 -mr-1 shrink-0", className)}
      onClick={() => setOpen(false)}
      size="icon"
      variant="ghost"
    >
      <Button.Icon
        aria-label={ariaLabel}
        icon={Minus}
      />
    </Button>
  );
}

/** Screen-reader labels of the step status. Pass `lang` to `OnboardingTimeline.Steps` to override any of them. */
export interface OnboardingTimelineStepLang {
  /** Status of a step before the current one. */
  completed: string;
  /** Status of the current step. */
  active: string;
  /** Status of a step after the current one. */
  upcoming: string;
}

/** English defaults for `OnboardingTimelineStepLang`. */
export const defaultOnboardingTimelineStepLang: OnboardingTimelineStepLang = {
  active: "Current step",
  completed: "Completed",
  upcoming: "Upcoming",
};

interface OnboardingTimelineStepContextValue {
  readonly status: OnboardingTimelineStepStatus;
  readonly lang: OnboardingTimelineStepLang;
}

const OnboardingTimelineStepContext =
  React.createContext<OnboardingTimelineStepContextValue | null>(null);

export interface OnboardingTimelineStepsProps
  extends Omit<React.HTMLAttributes<HTMLOListElement>, "lang"> {
  children: React.ReactNode;
  /**
   * Screen-reader labels of the step status. Merges over English defaults.
   * @default defaultOnboardingTimelineStepLang
   */
  lang?: Partial<OnboardingTimelineStepLang>;
}

/** Scrollable, connected vertical list of `Step`s — the timeline itself. Reads the current `value` from the `Root` context to derive each step's status. */
function OnboardingTimelineSteps({
  className,
  children,
  lang,
  ...props
}: OnboardingTimelineStepsProps) {
  const { value } = useOnboardingTimelineContext();
  const resolvedLang = { ...defaultOnboardingTimelineStepLang, ...lang };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ol
        className={cn(
          "mx-4 my-4 flex flex-col gap-6 border-border border-l-2 pl-6",
          className,
        )}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child;
          const status: OnboardingTimelineStepStatus =
            index < value
              ? "completed"
              : index === value
                ? "active"
                : "upcoming";
          return (
            <OnboardingTimelineStepContext.Provider
              value={{
                lang: resolvedLang,
                status,
              }}
            >
              {child}
            </OnboardingTimelineStepContext.Provider>
          );
        })}
      </ol>
    </div>
  );
}

export interface OnboardingTimelineStepProps {
  /** Step title. */
  title: React.ReactNode;
  /** Optional supporting detail rendered below the title. */
  description?: React.ReactNode;
  /** Extra content below the description — e.g. a `Button` action shown only for the active step. */
  children?: React.ReactNode;
  className?: string;
}

/** One step on the timeline. Its dot, title color, and connector are driven by the status `Steps` assigned it (`completed`/`active`/`upcoming`). */
function OnboardingTimelineStep({
  title,
  description,
  children,
  className,
}: OnboardingTimelineStepProps) {
  const context = React.useContext(OnboardingTimelineStepContext);
  if (!context) {
    throw new Error(
      "OnboardingTimeline.Step must be used within <OnboardingTimeline.Steps>.",
    );
  }
  const { status, lang } = context;
  const statusLabel =
    status === "completed"
      ? lang.completed
      : status === "active"
        ? lang.active
        : lang.upcoming;

  return (
    <li
      aria-current={status === "active" ? "step" : undefined}
      className={cn("relative", className)}
    >
      <span
        className={cn(
          "-left-8.25 absolute top-0.5 flex size-4 items-center justify-center rounded-full ring-4 ring-background",
          status === "completed" && "bg-foreground",
          status === "active" && "border-2 border-foreground bg-background",
          status === "upcoming" && "border border-border bg-background",
        )}
      >
        {status === "completed" && (
          <Icon
            className="text-background"
            icon={Check}
            size="xs"
          />
        )}
      </span>
      <div className="flex flex-col gap-0.5">
        <p
          className={cn(
            "font-medium font-primary text-sm",
            status === "upcoming" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {title} <span className="sr-only">({statusLabel})</span>
        </p>
        {description && (
          <p className="font-primary text-muted-foreground text-xs">
            {description}
          </p>
        )}
        {children && <div className="mt-1">{children}</div>}
      </div>
    </li>
  );
}

export interface OnboardingTimelineFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Optional bottom row of the panel — e.g. an overall `Progress` bar/label or a dismiss action. */
function OnboardingTimelineFooter({
  className,
  ...props
}: OnboardingTimelineFooterProps) {
  return (
    <div
      className={cn("border-border border-t px-4 py-3", className)}
      {...props}
    />
  );
}

/**
 * Compound floating onboarding checklist: a fixed bottom-right widget that
 * collapses to a progress-ringed icon button and expands into a vertical
 * timeline of steps.
 * @example
 * ```tsx
 * <OnboardingTimeline.Root totalSteps={3} value={1}>
 *   <OnboardingTimeline.Trigger />
 *   <OnboardingTimeline.Panel>
 *     <OnboardingTimeline.Header>
 *       <div className="flex flex-col gap-0.5">
 *         <OnboardingTimeline.Title>Get set up</OnboardingTimeline.Title>
 *       </div>
 *       <OnboardingTimeline.Close />
 *     </OnboardingTimeline.Header>
 *     <OnboardingTimeline.Steps>
 *       <OnboardingTimeline.Step title="Create your account" />
 *     </OnboardingTimeline.Steps>
 *   </OnboardingTimeline.Panel>
 * </OnboardingTimeline.Root>
 * ```
 */
export const OnboardingTimeline = {
  Close: OnboardingTimelineClose,
  Description: OnboardingTimelineDescription,
  Footer: OnboardingTimelineFooter,
  Header: OnboardingTimelineHeader,
  Panel: OnboardingTimelinePanel,
  Root: OnboardingTimelineRoot,
  Step: OnboardingTimelineStep,
  Steps: OnboardingTimelineSteps,
  Title: OnboardingTimelineTitle,
  Trigger: OnboardingTimelineTrigger,
};
