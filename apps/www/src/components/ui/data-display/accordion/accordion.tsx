"use client";

import { ChevronDown } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import { Icon } from "../../foundations/icon/icon";
import { cn } from "../../utils/tailwind/cn";

type AccordionType = "single" | "multiple";

interface AccordionContextValue {
  readonly type: AccordionType;
  readonly openItems: ReadonlySet<string>;
  readonly openOnHover: boolean;
  readonly setItemOpen: (value: string, open: boolean) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error(
      "Accordion subcomponents must be used within Accordion.Root.",
    );
  }
  return context;
}

interface AccordionItemContextValue {
  readonly value: string;
  readonly triggerId: string;
  readonly contentId: string;
  readonly isOpen: boolean;
  readonly disabled: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(
  null,
);

function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error(
      "Accordion.Trigger and Accordion.Content must be used within Accordion.Item.",
    );
  }
  return context;
}

function toSet(value: string | string[] | undefined): ReadonlySet<string> {
  if (!value) return new Set();
  return new Set(
    Array.isArray(value)
      ? value
      : [
          value,
        ],
  );
}

export interface AccordionRootProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** Items (`Accordion.Item`) that make up the accordion. */
  children: ReactNode;
  /**
   * `"single"` keeps at most one item open at a time; `"multiple"` lets any number stay open.
   * @default "single"
   */
  type?: AccordionType;
  /** Value(s) of the item(s) open on first render, for uncontrolled usage. */
  defaultValue?: string | string[];
  /** Value(s) of the open item(s), for controlled usage. Pair it with `onValueChange`. */
  value?: string | string[];
  /**
   * When `true`, items open on pointer hover and close when the pointer leaves, and mouse clicks no longer toggle them. When `false`, items toggle on click. Keyboard (Enter/Space) and touch taps always toggle, since they can't hover.
   * @default false
   */
  openOnHover?: boolean;
  /** Called with the new open value whenever an item is toggled — a `string` in `"single"` mode (empty when all are closed), a `string[]` in `"multiple"` mode. */
  onValueChange?: (value: string | string[]) => void;
  /** Extra classes merged onto the root element. */
  className?: string;
}

/**
 * Root of the compound accordion. Owns which items are open (controlled or
 * uncontrolled) and shares it with `Accordion.Item` via context.
 * @example
 * ```tsx
 * <Accordion.Root type="single" defaultValue="shipping">
 *   <Accordion.Item value="shipping">
 *     <Accordion.Trigger>Shipping</Accordion.Trigger>
 *     <Accordion.Content>Ships in 2–3 business days.</Accordion.Content>
 *   </Accordion.Item>
 * </Accordion.Root>
 * ```
 */
function Root({
  children,
  type = "single",
  openOnHover = false,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  ...props
}: AccordionRootProps) {
  const [internalOpen, setInternalOpen] = useState<ReadonlySet<string>>(() =>
    toSet(defaultValue),
  );

  const isControlled = controlledValue !== undefined;
  const openItems = useMemo(
    () => (isControlled ? toSet(controlledValue) : internalOpen),
    [
      controlledValue,
      internalOpen,
      isControlled,
    ],
  );

  const setItemOpen = useCallback(
    (itemValue: string, open: boolean) => {
      if (openItems.has(itemValue) === open) return;

      const next = new Set(openItems);

      if (open) {
        if (type === "single") next.clear();
        next.add(itemValue);
      } else {
        next.delete(itemValue);
      }

      if (!isControlled) setInternalOpen(next);

      onValueChange?.(
        type === "multiple"
          ? [
              ...next,
            ]
          : ([
              ...next,
            ][0] ?? ""),
      );
    },
    [
      isControlled,
      onValueChange,
      openItems,
      type,
    ],
  );

  const context = useMemo(
    () => ({
      openItems,
      openOnHover,
      setItemOpen,
      type,
    }),
    [
      openItems,
      openOnHover,
      setItemOpen,
      type,
    ],
  );

  return (
    <AccordionContext.Provider value={context}>
      <div
        className={cn("w-full", className)}
        data-accordion-root=""
        {...props}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Trigger and content of this item (`Accordion.Trigger`, `Accordion.Content`). */
  children: ReactNode;
  /** Unique value identifying this item within the accordion. */
  value: string;
  /**
   * Prevents the item from being toggled and skips it during keyboard navigation.
   * @default false
   */
  disabled?: boolean;
  /** Extra classes merged onto the item element. */
  className?: string;
}

/** A single collapsible section of the accordion. Groups an `Accordion.Trigger` with its `Accordion.Content` and links them via ARIA ids. */
function Item({
  children,
  value,
  disabled = false,
  className,
  onPointerEnter,
  onPointerLeave,
  ...props
}: AccordionItemProps) {
  const { openItems, openOnHover, setItemOpen } = useAccordionContext();
  const uid = useId();
  const triggerId = `accordion-trigger-${uid}`;
  const contentId = `accordion-content-${uid}`;
  const isOpen = openItems.has(value);

  const context = useMemo(
    () => ({
      contentId,
      disabled,
      isOpen,
      triggerId,
      value,
    }),
    [
      contentId,
      disabled,
      isOpen,
      triggerId,
      value,
    ],
  );

  return (
    <AccordionItemContext.Provider value={context}>
      <div
        className={cn("border-b border-border last:border-b-0", className)}
        data-disabled={disabled ? "" : undefined}
        data-state={isOpen ? "open" : "closed"}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (openOnHover && !disabled && event.pointerType === "mouse") {
            setItemOpen(value, true);
          }
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          if (openOnHover && !disabled && event.pointerType === "mouse") {
            setItemOpen(value, false);
          }
        }}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Label of the item, always visible. */
  children: ReactNode;
  /**
   * Level of the heading (`h1`–`h6`) that wraps the trigger. Match it to the surrounding document outline.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Extra classes merged onto the trigger button. */
  className?: string;
}

/**
 * Button that expands and collapses its `Accordion.Item`
 * (WAI-ARIA accordion pattern). Supports Enter/Space to toggle and
 * Arrow Up/Down, Home and End to move between triggers.
 */
function Trigger({
  children,
  headingLevel = 3,
  className,
  disabled: disabledProp,
  onClick,
  onKeyDown,
  ...props
}: AccordionTriggerProps) {
  const { openOnHover, setItemOpen } = useAccordionContext();
  const { value, triggerId, contentId, isOpen, disabled } =
    useAccordionItemContext();
  const isDisabled = disabled || disabledProp;
  const Heading = `h${headingLevel}` as const;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const root = event.currentTarget.closest("[data-accordion-root]");
    if (!root) return;

    const triggers = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        "button[data-accordion-trigger]:not(:disabled)",
      ),
    );
    const index = triggers.indexOf(event.currentTarget);
    if (index === -1) return;

    let nextIndex: number;
    switch (event.key) {
      case "ArrowDown":
        nextIndex = (index + 1) % triggers.length;
        break;
      case "ArrowUp":
        nextIndex = (index - 1 + triggers.length) % triggers.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = triggers.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    triggers[nextIndex]?.focus();
  };

  return (
    <Heading className="flex">
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        className={cn(
          "flex flex-1 items-center justify-between gap-4 rounded-md py-4 text-left text-sm font-medium font-primary text-foreground transition-colors duration-150 ease-in-out",
          "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
          "hover:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-foreground",
          !isDisabled && "cursor-pointer",
          className,
        )}
        data-accordion-trigger=""
        data-state={isOpen ? "open" : "closed"}
        disabled={isDisabled}
        id={triggerId}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          // In hover mode the pointer already opened/closed the item, so a
          // mouse click must not undo it. Keyboard and touch clicks (no
          // hover) still toggle.
          const { pointerType } = event.nativeEvent as PointerEvent;
          const isMouseClick =
            event.detail > 0 &&
            pointerType !== "touch" &&
            pointerType !== "pen";
          if (openOnHover && isMouseClick) return;
          setItemOpen(value, !isOpen);
        }}
        onKeyDown={handleKeyDown}
        type="button"
        {...props}
      >
        {children}
        <Icon
          aria-hidden="true"
          className={cn(
            "text-muted-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none",
            isOpen && "rotate-180",
          )}
          icon={ChevronDown}
        />
      </button>
    </Heading>
  );
}

export interface AccordionContentProps extends HTMLAttributes<HTMLElement> {
  /** Body revealed when the item is open. */
  children: ReactNode;
  /** Extra classes merged onto the padded content wrapper. */
  className?: string;
}

/** Collapsible panel of an `Accordion.Item`. Animates via a CSS grid-rows transition and stays out of the accessibility tree and tab order while closed. */
function Content({ children, className, ...props }: AccordionContentProps) {
  const { contentId, triggerId, isOpen } = useAccordionItemContext();

  return (
    <section
      aria-labelledby={triggerId}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      data-state={isOpen ? "open" : "closed"}
      id={contentId}
      // `grid-rows-[0fr]` only clips visually — `inert` also removes the
      // collapsed content from the accessibility tree and the tab order.
      inert={!isOpen}
      {...props}
    >
      <div className={cn("overflow-hidden", !isOpen && "invisible")}>
        <div
          className={cn(
            "pb-4 text-sm font-primary text-muted-foreground",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

/** Vertically stacked set of collapsible sections (`Root`, `Item`, `Trigger`, `Content`). */
export const Accordion = Object.assign(Root, {
  Content,
  Item,
  Trigger,
});
