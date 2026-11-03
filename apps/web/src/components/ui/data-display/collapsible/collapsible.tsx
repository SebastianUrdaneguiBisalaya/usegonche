"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";
import { Icon } from "../../foundations/icon/icon";
import { cn } from "../../utils/tailwind/cn";

interface CollapsibleContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly disabled: boolean;
  readonly triggerId: string;
  readonly contentId: string;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(
  null,
);

function useCollapsibleContext() {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error(
      "Collapsible subcomponents must be used within <Collapsible.Root>.",
    );
  }
  return context;
}

export interface CollapsibleRootProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  /** Open state, for controlled usage. Pair it with `onOpenChange`. */
  open?: boolean;
  /** Initial open state, for uncontrolled usage. @default false */
  defaultOpen?: boolean;
  /** Called whenever the open state changes, controlled or not. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Prevents the trigger from toggling the content.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Compound collapsible — a single region that expands and collapses on
 * demand, for "show more", filter groups, and advanced settings. Use
 * `Accordion` instead when several sections belong together. Owns the open
 * state (controlled or uncontrolled) and links `Collapsible.Trigger` to
 * `Collapsible.Content` through ARIA ids.
 * @example
 * ```tsx
 * <Collapsible.Root>
 *   <Collapsible.Trigger>Advanced options</Collapsible.Trigger>
 *   <Collapsible.Content>…</Collapsible.Content>
 * </Collapsible.Root>
 * ```
 */
function CollapsibleRoot({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  children,
  ...props
}: CollapsibleRootProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const uid = React.useId();

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [
      isControlled,
      onOpenChange,
    ],
  );

  const value = React.useMemo<CollapsibleContextValue>(
    () => ({
      contentId: `collapsible-content-${uid}`,
      disabled,
      open,
      setOpen,
      triggerId: `collapsible-trigger-${uid}`,
    }),
    [
      disabled,
      open,
      setOpen,
      uid,
    ],
  );

  return (
    <CollapsibleContext.Provider value={value}>
      <div
        className={cn("w-full", className)}
        data-disabled={disabled ? "" : undefined}
        data-state={open ? "open" : "closed"}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Label of the trigger. Pass a function to swap it with the state, e.g. `(open) => (open ? "Show less" : "Show more")`. */
  children?: React.ReactNode | ((open: boolean) => React.ReactNode);
  /**
   * Shows a chevron that rotates while open. Turn it off for a trigger whose label already says what it does (e.g. "Show more").
   * @default true
   */
  chevron?: boolean;
}

/** Button that toggles its `Collapsible.Root`. A real `<button>`, so Enter and Space work natively. */
function CollapsibleTrigger({
  chevron = true,
  className,
  children,
  disabled: disabledProp,
  onClick,
  ...props
}: CollapsibleTriggerProps) {
  const { open, setOpen, disabled, triggerId, contentId } =
    useCollapsibleContext();
  const isDisabled = disabled || disabledProp;

  return (
    <button
      aria-controls={contentId}
      aria-expanded={open}
      className={cn(
        "flex w-fit items-center gap-2 rounded-md font-primary text-sm font-medium text-foreground transition-colors duration-150 ease-in-out",
        "hover:text-muted-foreground",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-foreground",
        !isDisabled && "cursor-pointer",
        className,
      )}
      data-state={open ? "open" : "closed"}
      disabled={isDisabled}
      id={triggerId}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setOpen(!open);
      }}
      type="button"
      {...props}
    >
      {typeof children === "function" ? children(open) : children}
      {chevron && (
        <Icon
          aria-hidden="true"
          className={cn(
            "text-muted-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
          icon={ChevronDown}
        />
      )}
    </button>
  );
}

export interface CollapsibleContentProps
  extends React.HTMLAttributes<HTMLElement> {
  /**
   * Height (px when a number) that stays visible while closed, fading out at its bottom edge — a preview for "show more" on a long paragraph. At `0` the content is fully hidden, inert and out of the accessibility tree; above `0` it remains readable while closed. Place `Collapsible.Trigger` after the content in that case.
   * @default 0
   */
  collapsedSize?: number | string;
}

/** The region revealed by `Collapsible.Trigger`. Animates its height with a CSS grid-rows transition and stays out of the accessibility tree and tab order while closed. */
function CollapsibleContent({
  collapsedSize = 0,
  className,
  style,
  children,
  ...props
}: CollapsibleContentProps) {
  const { open, triggerId, contentId } = useCollapsibleContext();
  const hasPreview = collapsedSize !== 0 && collapsedSize !== "0";
  const fade =
    hasPreview && !open
      ? "linear-gradient(to bottom, black calc(100% - 2rem), transparent)"
      : undefined;

  return (
    <section
      aria-labelledby={triggerId}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      data-state={open ? "open" : "closed"}
      id={contentId}
      // `grid-rows-[0fr]` only clips visually — `inert` also removes the
      // collapsed content from the accessibility tree and the tab order.
      inert={!open && !hasPreview}
      style={style}
      {...props}
    >
      <div
        className={cn("overflow-hidden", !open && !hasPreview && "invisible")}
        style={{
          maskImage: fade,
          minHeight: collapsedSize,
          WebkitMaskImage: fade,
        }}
      >
        <div className={cn(!hasPreview && "pt-3", className)}>{children}</div>
      </div>
    </section>
  );
}

export const Collapsible = Object.assign(CollapsibleRoot, {
  Content: CollapsibleContent,
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
});
