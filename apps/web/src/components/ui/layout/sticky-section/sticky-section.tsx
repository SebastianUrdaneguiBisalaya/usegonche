"use client";

import * as React from "react";

import { cn } from "../../utils/tailwind/cn";

export type StickySectionOrientation = "vertical" | "horizontal";

interface StickySectionContextValue {
  readonly orientation: StickySectionOrientation;
}

const StickySectionContext =
  React.createContext<StickySectionContextValue | null>(null);

function useStickySectionContext() {
  const context = React.useContext(StickySectionContext);
  if (!context) {
    throw new Error(
      "StickySection subcomponents must be used within <StickySection.Root>.",
    );
  }
  return context;
}

export interface StickySectionRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * `"vertical"` stacks each section full-width, its `Header` covering the
   * previous section's header as it scrolls into that same top position —
   * an Apple/Stripe-marketing-page-style takeover.
   * `"horizontal"` instead lays each section out as a two-column row (label
   * left, content right, e.g. a docs/FAQ page): every section's `Header`
   * stays pinned in the left column for as long as its own `Body` is
   * scrolling past on the right, then hands off to the next section's
   * label once its content ends.
   * @default "vertical"
   */
  orientation?: StickySectionOrientation;
  /**
   * Distance in px from the top of the viewport at which each section's
   * header sticks — set this to the height of a fixed site header, if any,
   * so sticky headers dock right below it instead of the viewport edge.
   * @default 0
   */
  offset?: number;
}

/**
 * Root of the compound sticky-section list. Renders each `StickySection.Item`
 * in normal document flow and drives both layouts purely with CSS
 * `position: sticky` (no JS/IntersectionObserver): in `"vertical"`
 * orientation a later item's `Header` paints on top of an earlier one at the
 * same sticky offset; in `"horizontal"` orientation each item's `Header`
 * sticks within its own row so it stays visible for exactly as long as its
 * `Body` is in view.
 * @example
 * ```tsx
 * // Vertical — header takeover
 * <StickySection.Root>
 *   <StickySection.Item>
 *     <StickySection.Header>Introduction</StickySection.Header>
 *     <StickySection.Body>...</StickySection.Body>
 *   </StickySection.Item>
 *   <StickySection.Item>
 *     <StickySection.Header>Features</StickySection.Header>
 *     <StickySection.Body>...</StickySection.Body>
 *   </StickySection.Item>
 * </StickySection.Root>
 *
 * // Horizontal — left labels, right content
 * <StickySection.Root orientation="horizontal">
 *   <StickySection.Item>
 *     <StickySection.Header>Introduction</StickySection.Header>
 *     <StickySection.Body>...</StickySection.Body>
 *   </StickySection.Item>
 * </StickySection.Root>
 * ```
 */
function StickySectionRoot({
  orientation = "vertical",
  offset = 0,
  className,
  style,
  children,
  ...props
}: StickySectionRootProps) {
  const value = React.useMemo<StickySectionContextValue>(
    () => ({
      orientation,
    }),
    [
      orientation,
    ],
  );

  return (
    <StickySectionContext.Provider value={value}>
      <div
        className={cn(
          "flex flex-col",
          orientation === "horizontal" && "gap-8",
          className,
        )}
        style={
          {
            ...style,
            // Consumed by StickySection.Header's `top` so every header in this
            // Root sticks at the same viewport position.
            "--sticky-section-offset": `${offset}px`,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </StickySectionContext.Provider>
  );
}

export interface StickySectionItemProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * One section. In `"vertical"` orientation its `Header` stays pinned while
 * `Body` scrolls beneath it, until the next item's header takes over the
 * same position. In `"horizontal"` orientation it's a two-column row —
 * `Header` in a fixed-width left column, `Body` filling the right column —
 * and `Header` stays pinned for exactly the height of this row.
 */
function StickySectionItem({
  className,
  children,
  ...props
}: StickySectionItemProps) {
  const { orientation } = useStickySectionContext();

  return (
    <section
      className={cn(
        "relative",
        orientation === "horizontal" &&
          "grid grid-cols-[minmax(0,220px)_1fr] gap-8",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export interface StickySectionHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Pinned header for a `StickySection.Item`.
 * In `"vertical"` orientation it needs an opaque `bg-background` (the
 * default) so it fully occludes the previous section's content — and
 * header — as it scrolls beneath it.
 * In `"horizontal"` orientation it's the left-column label and doesn't need
 * a background, since it never overlaps sibling content.
 */
function StickySectionHeader({
  className,
  style,
  children,
  ...props
}: StickySectionHeaderProps) {
  const { orientation } = useStickySectionContext();

  return (
    <div
      className={cn(
        "sticky z-10 font-primary text-sm font-semibold text-foreground",
        orientation === "vertical"
          ? "border-b border-border bg-background px-4 py-3"
          : "h-fit self-start",
        className,
      )}
      style={{
        ...style,
        top: "var(--sticky-section-offset)",
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface StickySectionBodyProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Content of a `StickySection.Item`. In `"vertical"` orientation it's rendered below its `Header`; in `"horizontal"` orientation it's the right column next to it. Give it enough height (e.g. `min-h-screen` for vertical, or just a few paragraphs for horizontal) for the sticky effect to be visible. */
function StickySectionBody({
  className,
  children,
  ...props
}: StickySectionBodyProps) {
  const { orientation } = useStickySectionContext();

  return (
    <div
      className={cn(
        orientation === "vertical" ? "px-4 py-6" : "min-w-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const StickySection = {
  Body: StickySectionBody,
  Header: StickySectionHeader,
  Item: StickySectionItem,
  Root: StickySectionRoot,
};
