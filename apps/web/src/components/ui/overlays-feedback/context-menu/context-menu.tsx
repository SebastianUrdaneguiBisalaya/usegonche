"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Separator } from "../../foundations/separator/separator";
import { useClickOutside } from "../../hooks/useClickOutside";
import { cn } from "../../utils/tailwind/cn";
import { useEscapeKey } from "../modal/modal";

interface Point {
  x: number;
  y: number;
}

interface ContextMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  position: Point;
  openAt: (position: Point) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(
  null,
);

function useContextMenuContext() {
  const context = React.useContext(ContextMenuContext);
  if (!context)
    throw new Error(
      "ContextMenu compound components must be used within <ContextMenu>.",
    );
  return context;
}

export interface ContextMenuProps {
  children: React.ReactNode;
  /** Open state, for controlled usage. */
  open?: boolean;
  /**
   * Initial open state, for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called whenever the open state changes, controlled or not. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Compound right-click menu, following the WAI-ARIA Menu pattern. Unlike `Dropdown`, it has no visible trigger
 * button: `ContextMenu.Trigger` wraps the region that should react to a right-click (a table row, a card, a
 * canvas), and the panel opens at the pointer instead of anchored to an element. A keyboard user reaches it the
 * platform's own way — the `ContextMenu` key or Shift+F10 — since that also fires the native `contextmenu` event
 * this listens for.
 *
 * @example
 * ```tsx
 * <ContextMenu>
 *   <ContextMenu.Trigger>
 *     <TableRow />
 *   </ContextMenu.Trigger>
 *   <ContextMenu.Content>
 *     <ContextMenu.Item onSelect={rename}>Rename</ContextMenu.Item>
 *     <ContextMenu.Separator />
 *     <ContextMenu.Item onSelect={remove} variant="destructive">Delete</ContextMenu.Item>
 *   </ContextMenu.Content>
 * </ContextMenu>
 * ```
 */
function ContextMenuRoot({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: ContextMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const [position, setPosition] = React.useState<Point>({
    x: 0,
    y: 0,
  });

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

  const openAt = React.useCallback(
    (next: Point) => {
      setPosition(next);
      setOpen(true);
    },
    [
      setOpen,
    ],
  );

  const contentRef = React.useRef<HTMLDivElement>(null);

  useClickOutside(contentRef, () => setOpen(false), undefined, open);
  useEscapeKey(open, () => setOpen(false));

  React.useEffect(() => {
    if (!open) return;
    // A point-anchored menu has nothing sensible to follow while the page scrolls underneath it, so it
    // closes instead of drifting away from the row/card it was opened on (matches native OS context menus).
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [
    open,
    setOpen,
  ]);

  const value = React.useMemo<ContextMenuContextValue>(
    () => ({
      contentRef,
      open,
      openAt,
      position,
      setOpen,
    }),
    [
      open,
      openAt,
      position,
      setOpen,
    ],
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export interface ContextMenuTriggerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Disables the right-click handler, letting the browser's native menu through. */
  disabled?: boolean;
}

/** The region that opens the menu on right-click. Rendered `display: contents`, so it never affects `children`'s layout. */
function Trigger({
  children,
  disabled = false,
  className,
  onContextMenu,
  ...props
}: ContextMenuTriggerProps) {
  const { openAt } = useContextMenuContext();

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click has no keyboard-equivalent DOM event to pair it with here — a keyboard user reaches this menu through the platform's own Menu-key/Shift+F10 gesture, which fires this same `contextmenu` event.
    <div
      className={cn("contents", className)}
      onContextMenu={(event) => {
        onContextMenu?.(event);
        if (disabled || event.defaultPrevented) return;
        event.preventDefault();
        openAt({
          x: event.clientX,
          y: event.clientY,
        });
      }}
      {...props}
    >
      {children}
    </div>
  );
}

const GAP = 4;

function focusMenuItemAt(menu: HTMLElement, index: number) {
  const items = Array.from(
    menu.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    ),
  );
  if (items.length === 0) return;
  items[((index % items.length) + items.length) % items.length].focus();
}

export interface ContextMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Portaled menu panel, opened at the pointer and clamped back inside the viewport. Supports arrow-key/Home/End navigation between `ContextMenu.Item`s. */
function Content({ className, children, ...props }: ContextMenuContentProps) {
  const { open, position, contentRef } = useContextMenuContext();
  const [style, setStyle] = React.useState<React.CSSProperties>({
    opacity: 0,
    pointerEvents: "none",
    position: "fixed",
  });

  React.useLayoutEffect(() => {
    if (!open) return;
    const content = contentRef.current;
    if (!content) return;

    const contentRect = content.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    setStyle({
      left: Math.min(position.x, viewportWidth - GAP - contentRect.width),
      position: "fixed",
      top: Math.min(position.y, viewportHeight - GAP - contentRect.height),
    });
  }, [
    open,
    position,
    contentRef,
  ]);

  React.useEffect(() => {
    if (open)
      contentRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
  }, [
    open,
    contentRef,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const menu = event.currentTarget;
    const items = Array.from(
      menu.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItemAt(menu, index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItemAt(menu, index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItemAt(menu, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItemAt(menu, items.length - 1);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "z-50 min-w-40 animate-fade-scale-in rounded-md border border-border bg-background p-1 shadow-md",
        className,
      )}
      onKeyDown={handleKeyDown}
      ref={contentRef}
      role="menu"
      style={style}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface ContextMenuItemProps {
  children: React.ReactNode;
  /** Called when this item is chosen (click, or Enter/Space while focused). Closes the menu afterward. */
  onSelect: () => void;
  disabled?: boolean;
  /** Styles the item as a destructive action (e.g. "Delete"). */
  variant?: "default" | "destructive";
  className?: string;
}

/** One menu action. */
function Item({
  children,
  onSelect,
  disabled = false,
  variant = "default",
  className,
}: ContextMenuItemProps) {
  const { setOpen } = useContextMenuContext();

  const activate = () => {
    if (disabled) return;
    onSelect();
    setOpen(false);
  };

  return (
    <div
      aria-disabled={disabled}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left font-primary text-sm outline-none transition-colors duration-100 ease-in-out",
        disabled
          ? "cursor-not-allowed opacity-40"
          : variant === "destructive"
            ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
            : "text-foreground hover:bg-muted focus:bg-muted",
        className,
      )}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
      role="menuitem"
      tabIndex={-1}
    >
      {children}
    </div>
  );
}

export interface ContextMenuLabelProps {
  children: React.ReactNode;
  className?: string;
}

/** Non-interactive section heading above a run of `ContextMenu.Item`s. */
function Label({ children, className }: ContextMenuLabelProps) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 font-primary text-xs font-medium text-muted-foreground",
        className,
      )}
      role="presentation"
    >
      {children}
    </div>
  );
}

export interface ContextMenuSeparatorProps {
  className?: string;
}

/** Divider between groups of `ContextMenu.Item`s. */
function ContextMenuSeparator({ className }: ContextMenuSeparatorProps) {
  return (
    <Separator
      className={cn("my-1", className)}
      decorative
    />
  );
}

export const ContextMenu = Object.assign(ContextMenuRoot, {
  Content,
  Item,
  Label,
  Separator: ContextMenuSeparator,
  Trigger,
});
