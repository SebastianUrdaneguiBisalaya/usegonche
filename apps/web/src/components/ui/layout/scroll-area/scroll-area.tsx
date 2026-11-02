"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import * as React from "react";
import { Icon } from "../../foundations/icon/icon";
import {
  type AutoScrollMode,
  useAutoScrollToBottom,
} from "../../hooks/useAutoScrollToBottom";
import { cn } from "../../utils/tailwind/cn";

/** How close to an edge (in px) counts as "there", for `atTop`/`atBottom` and `ScrollArea.ScrollButton`'s auto-hide. */
const EDGE_THRESHOLD = 24;

/** Default width (in px) of the scroll-fade gradient when `fadeEdges` is on. */
const DEFAULT_FADE_SIZE = 32;

/**
 * Builds the `mask-image` gradient for `fadeEdges`: fully opaque where an
 * edge is reached (nothing to hide), fading to transparent over
 * `fadeSize`px on whichever edge still has clipped content.
 */
function getFadeMask(
  atTop: boolean,
  atBottom: boolean,
  fadeSize: number,
): string | undefined {
  if (atTop && atBottom) return undefined;

  const stops: string[] = [
    atTop ? "black 0" : "transparent 0",
  ];
  if (!atTop) stops.push(`black ${fadeSize}px`);
  if (!atBottom) stops.push(`black calc(100% - ${fadeSize}px)`);
  stops.push(atBottom ? "black 100%" : "transparent 100%");

  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

interface ScrollAreaContextValue {
  readonly viewportRef: React.RefObject<HTMLDivElement | null>;
  readonly atTop: boolean;
  readonly atBottom: boolean;
  readonly fadeEdges: boolean;
  readonly fadeSize: number;
}

const ScrollAreaContext = React.createContext<ScrollAreaContextValue | null>(
  null,
);

function useScrollAreaContext() {
  const context = React.useContext(ScrollAreaContext);
  if (!context) {
    throw new Error(
      "ScrollArea subcomponents must be used within <ScrollArea>.",
    );
  }
  return context;
}

export interface ScrollAreaRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Follows new content automatically, parking the viewport on its newest
   * end — the "stick to the latest message" behaviour of a chat transcript.
   * Off by default, so a scroll region never moves on its own unless asked;
   * `ScrollArea.ScrollButton` stays the manual way back to the bottom either
   * way (and keeps working here, since scrolling up detaches the follow).
   * @default false
   */
  autoScroll?: boolean;
  /**
   * How aggressively `autoScroll` follows: `"pinned"` only while the reader
   * is already at the bottom, `"always"` on every growth even mid-read.
   * @default "pinned"
   */
  autoScrollMode?: AutoScrollMode;
  /**
   * Scroll animation used when `autoScroll` follows new content (the initial
   * landing is always instant). Ignored under `prefers-reduced-motion`.
   * @default "smooth"
   */
  autoScrollBehavior?: ScrollBehavior;
  /**
   * Fades `Viewport`'s content near whichever edge still has clipped
   * content (via `mask-image`), as a visual hint that the region scrolls —
   * the fade disappears once that edge is reached. Off by default.
   * @default false
   */
  fadeEdges?: boolean;
  /**
   * Width (in px) of the `fadeEdges` gradient. Ignored when `fadeEdges` is off.
   * @default 32
   */
  fadeSize?: number;
}

/**
 * Clips `Viewport` to a fixed shape (rounded corners, border, etc. via
 * `className`) and tracks whether it's scrolled to the top/bottom edge, for
 * `ScrollArea.ScrollButton`.
 */
function ScrollAreaRoot({
  autoScroll = false,
  autoScrollMode = "pinned",
  autoScrollBehavior = "smooth",
  fadeEdges = false,
  fadeSize = DEFAULT_FADE_SIZE,
  className,
  children,
  ...props
}: ScrollAreaRootProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = React.useState(true);
  const [atBottom, setAtBottom] = React.useState(true);

  const updateEdges = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setAtTop(viewport.scrollTop <= EDGE_THRESHOLD);
    setAtBottom(
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
        EDGE_THRESHOLD,
    );
  }, []);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateEdges();
    viewport.addEventListener("scroll", updateEdges, {
      passive: true,
    });

    // Content (e.g. a new chat message) can grow the scrollable area without
    // resizing the viewport itself or firing a "scroll" event — a
    // `ResizeObserver` on both catches that case, so `atBottom` stays
    // accurate for an auto-hiding `ScrollArea.ScrollButton`.
    const observer = new ResizeObserver(updateEdges);
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer.observe(content);

    return () => {
      viewport.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, [
    updateEdges,
  ]);

  useAutoScrollToBottom({
    behavior: autoScrollBehavior,
    enabled: autoScroll,
    mode: autoScrollMode,
    scrollableRef: viewportRef,
  });

  const value = React.useMemo<ScrollAreaContextValue>(
    () => ({
      atBottom,
      atTop,
      fadeEdges,
      fadeSize,
      viewportRef,
    }),
    [
      atBottom,
      atTop,
      fadeEdges,
      fadeSize,
    ],
  );

  return (
    <ScrollAreaContext.Provider value={value}>
      <div
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    </ScrollAreaContext.Provider>
  );
}

/**
 * Optional access to the enclosing `ScrollArea`'s scrollable viewport —
 * returns `null` outside one instead of throwing, so a transcript component
 * (`Messages`, `Chat`) can drive that viewport when it's wrapped in a
 * `ScrollArea` and fall back to its nearest scrollable ancestor when it isn't.
 */
export function useScrollAreaViewportRef(): React.RefObject<HTMLDivElement | null> | null {
  return React.useContext(ScrollAreaContext)?.viewportRef ?? null;
}

export interface ScrollAreaViewportProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * The actual scrollable region. Uses the platform's native scrollbar (thinned
 * and re-colored via CSS, not reimplemented in JS) — WCAG 2.1.1 requires a
 * scrollable region to be keyboard-reachable, so it's focusable by default.
 */
function ScrollAreaViewport({
  className,
  style,
  tabIndex,
  ...props
}: ScrollAreaViewportProps) {
  const { viewportRef, atTop, atBottom, fadeEdges, fadeSize } =
    useScrollAreaContext();
  const fadeMask = fadeEdges
    ? getFadeMask(atTop, atBottom, fadeSize)
    : undefined;

  return (
    <div
      className={cn(
        "h-full w-full overflow-auto rounded-[inherit]",
        "scrollbar-thin [scrollbar-color:var(--border)_transparent]",
        "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        className,
      )}
      ref={viewportRef}
      style={
        fadeMask
          ? { ...style, WebkitMaskImage: fadeMask, maskImage: fadeMask }
          : style
      }
      tabIndex={tabIndex ?? 0}
      {...props}
    />
  );
}

export interface ScrollAreaScrollButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /**
   * Which edge this scrolls to. It also only renders once the viewport has
   * scrolled away from that edge, and hides again once it arrives there —
   * the "jump to latest message" pattern in a chat thread
   * (`direction="bottom"`, the default) built from `ScrollArea` + `Messages`.
   * @default "bottom"
   */
  direction?: "top" | "bottom";
  /** Renders a small count pill (e.g. unread messages) on the button. Nothing renders at `0`. @default 0 */
  badgeCount?: number;
  /** Defaults to a down/up arrow icon matching `direction`. */
  children?: React.ReactNode;
  /**
   * Accessible name of the button.
   * @default "Scroll to latest" (direction "bottom") or "Scroll to top" (direction "top")
   */
  "aria-label"?: string;
}

/** Floating button over `ScrollArea.Viewport` that scrolls smoothly to `direction`'s edge. */
function ScrollAreaScrollButton({
  direction = "bottom",
  badgeCount = 0,
  className,
  children,
  onClick,
  "aria-label": ariaLabel,
  ...props
}: ScrollAreaScrollButtonProps) {
  const { viewportRef, atTop, atBottom } = useScrollAreaContext();
  const atEdge = direction === "bottom" ? atBottom : atTop;

  if (atEdge) return null;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    viewportRef.current?.scrollTo({
      behavior: "smooth",
      top: direction === "bottom" ? viewportRef.current.scrollHeight : 0,
    });
  };

  return (
    <button
      aria-label={
        ariaLabel ??
        (direction === "bottom" ? "Scroll to latest" : "Scroll to top")
      }
      className={cn(
        "absolute left-1/2 z-10 flex size-8 shrink-0 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-colors duration-150 ease-in-out",
        "hover:bg-muted",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        direction === "bottom" ? "bottom-3" : "top-3",
        className,
      )}
      onClick={handleClick}
      type="button"
      {...props}
    >
      {children ?? (
        <Icon
          icon={direction === "bottom" ? ArrowDown : ArrowUp}
          size="sm"
        />
      )}
      {badgeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-0.5 font-primary text-[0.625rem] font-semibold leading-none text-background">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </button>
  );
}

/**
 * Compound scroll area.
 * @example
 * ```tsx
 * <ScrollArea autoScroll className="relative h-64 rounded-md border border-border">
 *   <ScrollArea.Viewport>
 *     <Messages>...</Messages>
 *   </ScrollArea.Viewport>
 *   <ScrollArea.ScrollButton badgeCount={unreadCount} />
 * </ScrollArea>
 * ```
 */
export const ScrollArea = Object.assign(ScrollAreaRoot, {
  ScrollButton: ScrollAreaScrollButton,
  Viewport: ScrollAreaViewport,
});
