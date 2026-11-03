"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { Icon } from "../../foundations/icon/icon";
import { cn } from "../../utils/tailwind/cn";

export type StepStatus = "completed" | "active" | "upcoming";

interface StepperContextValue {
  readonly value: number;
  readonly orientation: "horizontal" | "vertical";
}

const StepperContext = React.createContext<StepperContextValue | null>(null);

function useStepperContext() {
  const context = React.useContext(StepperContext);
  if (!context) {
    throw new Error("Stepper subcomponents must be used within <Stepper>.");
  }
  return context;
}

interface StepContextValue {
  readonly status: StepStatus;
  readonly index: number;
}

const StepContext = React.createContext<StepContextValue | null>(null);

function useStepContext() {
  const context = React.useContext(StepContext);
  if (!context) {
    throw new Error(
      "Stepper.Indicator/Title/Description must be used within <Stepper.Step>.",
    );
  }
  return context;
}

/** Texts rendered by `Stepper`. Pass `lang` to override any of them. */
export interface StepperLang {
  /** Accessible label for the `<nav>` landmark. */
  progressLabel: string;
}

/** English defaults for `StepperLang`. */
export const defaultStepperLang: StepperLang = {
  progressLabel: "Progress",
};

export interface StepperProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "lang"> {
  /** 0-indexed position of the current step. Steps before it are "completed", this one is "active", later ones are "upcoming". */
  value: number;
  /**
   * Layout axis.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Texts rendered by this component. Merges over English defaults.
   * @default defaultStepperLang
   */
  lang?: Partial<StepperLang>;
  children: React.ReactNode;
}

/**
 * Compound multi-step progress indicator (wizard/checkout flow).
 * @example
 * ```tsx
 * <Stepper value={1}>
 *   <Stepper.Step>
 *     <Stepper.Indicator />
 *     <Stepper.Title>Account</Stepper.Title>
 *   </Stepper.Step>
 *   <Stepper.Step>
 *     <Stepper.Indicator />
 *     <Stepper.Title>Payment</Stepper.Title>
 *   </Stepper.Step>
 * </Stepper>
 * ```
 */
function StepperRoot({
  value,
  orientation = "horizontal",
  lang,
  className,
  children,
  ...props
}: StepperProps) {
  const resolvedLang = { ...defaultStepperLang, ...lang };
  const contextValue = React.useMemo(
    () => ({
      orientation,
      value,
    }),
    [
      orientation,
      value,
    ],
  );
  const stepCount = React.Children.count(children);

  return (
    <StepperContext.Provider value={contextValue}>
      <nav
        aria-label={resolvedLang.progressLabel}
        className={className}
        {...props}
      >
        <ol
          className={cn(
            "flex",
            orientation === "horizontal"
              ? "w-full items-start"
              : "flex-col gap-1",
          )}
        >
          {React.Children.map(children, (child, index) => {
            if (!React.isValidElement(child)) return child;
            const status: StepStatus =
              index < value
                ? "completed"
                : index === value
                  ? "active"
                  : "upcoming";
            return (
              <StepInjectedContext
                index={index}
                isLast={index === stepCount - 1}
                status={status}
              >
                {child}
              </StepInjectedContext>
            );
          })}
        </ol>
      </nav>
    </StepperContext.Provider>
  );
}

function StepInjectedContext({
  index,
  status,
  isLast,
  children,
}: {
  index: number;
  status: StepStatus;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const stepContextValue = React.useMemo(
    () => ({
      index,
      status,
    }),
    [
      index,
      status,
    ],
  );
  return (
    <StepContext.Provider value={stepContextValue}>
      <LastStepContext.Provider value={isLast}>
        {children}
      </LastStepContext.Provider>
    </StepContext.Provider>
  );
}

const LastStepContext = React.createContext(false);

export interface StepperStepProps extends React.HTMLAttributes<HTMLLIElement> {
  children: React.ReactNode;
}

/** One step. Renders `Stepper.Indicator`/`Title`/`Description` plus a connector to the next step, unless it's the last one. */
function Step({ className, children, ...props }: StepperStepProps) {
  const { orientation } = useStepperContext();
  const { status, index } = useStepContext();
  const isLast = React.useContext(LastStepContext);

  return (
    <li
      aria-current={status === "active" ? "step" : undefined}
      className={cn(
        "flex",
        orientation === "horizontal"
          ? cn("items-center gap-2", !isLast && "flex-1")
          : "flex-col gap-2",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex",
          orientation === "horizontal"
            ? "items-center gap-2"
            : "items-start gap-3",
        )}
      >
        {children}
      </div>
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "bg-border",
            orientation === "horizontal"
              ? "mx-2 h-px flex-1"
              : "ml-3.5 h-6 w-px",
          )}
          data-step-index={index}
        />
      )}
    </li>
  );
}

export interface StepperIndicatorProps {
  className?: string;
}

/** Numbered/checked circle showing the step's status. */
function Indicator({ className }: StepperIndicatorProps) {
  const { index, status } = useStepContext();

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border font-primary text-xs font-medium transition-colors duration-150 ease-in-out",
        status === "completed" &&
          "border-transparent bg-foreground text-background",
        status === "active" && "border-foreground text-foreground",
        status === "upcoming" && "border-border text-muted-foreground",
        className,
      )}
    >
      {status === "completed" ? (
        <Icon
          aria-hidden="true"
          icon={Check}
          size="xs"
        />
      ) : (
        index + 1
      )}
    </span>
  );
}

export interface StepperTitleProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

/** Step label. */
function Title({ className, ...props }: StepperTitleProps) {
  const { status } = useStepContext();
  return (
    <span
      className={cn(
        "font-primary text-sm font-medium",
        status === "upcoming" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface StepperDescriptionProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

/** Optional supporting text below `Stepper.Title`. */
function Description({ className, ...props }: StepperDescriptionProps) {
  return (
    <span
      className={cn("font-primary text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export const Stepper = Object.assign(StepperRoot, {
  Description,
  Indicator,
  Step,
  Title,
});
