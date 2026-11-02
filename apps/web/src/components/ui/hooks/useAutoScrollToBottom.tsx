"use client";

import * as React from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** How close to the bottom edge (in px) still counts as "at the bottom". */
const BOTTOM_THRESHOLD = 24;

/**
 * When an auto-scrolling region follows new content.
 * - `"pinned"` — only while the reader is already at the bottom; scrolling up
 *   detaches them and nothing yanks them back until they return to the bottom
 *   (the behaviour every chat product uses).
 * - `"always"` — every growth jumps to the bottom, even mid-read. Only use it
 *   for a feed nobody is expected to read backwards; it takes scroll control
 *   away from the user (WCAG 2.2.2-adjacent), so `"pinned"` is the default.
 */
export type AutoScrollMode = "pinned" | "always";

export interface UseAutoScrollToBottomOptions {
  /** The element whose growth should trigger the scroll (the transcript itself). When `scrollableRef` isn't given, its nearest scrollable ancestor becomes the scroll container. */
  contentRef?: React.RefObject<HTMLElement | null>;
  /** The scroll container. Defaults to `contentRef`'s nearest scrollable ancestor; when it's given and `contentRef` isn't, the container itself is watched for growth. */
  scrollableRef?: React.RefObject<HTMLElement | null> | null;
  /** Turns the behaviour on. Off by default so a scroll region never steals scroll position unless asked. @default false */
  enabled?: boolean;
  /** How aggressively to follow new content. @default "pinned" */
  mode?: AutoScrollMode;
  /** Scroll animation for subsequent jumps (the initial landing is always instant). Forced to `"auto"` under `prefers-reduced-motion: reduce`. @default "smooth" */
  behavior?: ScrollBehavior;
}

/** Walks up from `element` to the first ancestor that actually scrolls vertically. */
function findScrollableAncestor(
  element: HTMLElement | null,
): HTMLElement | null {
  let current = element?.parentElement ?? null;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * Keeps a scroll container parked on its newest content — the "stick to the
 * latest message" behaviour of a chat transcript.
 *
 * Growth is detected with a `ResizeObserver` on the content (a new turn, or a
 * streamed answer getting taller, changes the scroll height without firing a
 * `scroll` event), and "is the reader at the bottom?" is re-read from the live
 * scroll position on every scroll, so `mode: "pinned"` never fights someone
 * who scrolled up to re-read something.
 */
export function useAutoScrollToBottom({
  contentRef,
  scrollableRef,
  enabled = false,
  mode = "pinned",
  behavior = "smooth",
}: UseAutoScrollToBottomOptions) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const pinnedRef = React.useRef(true);

  React.useEffect(() => {
    if (!enabled) return;

    const content = contentRef?.current ?? null;
    const scrollable =
      scrollableRef?.current ?? findScrollableAncestor(content);
    if (!scrollable) return;

    const isAtBottom = () =>
      scrollable.scrollHeight -
        scrollable.scrollTop -
        scrollable.clientHeight <=
      BOTTOM_THRESHOLD;

    const scrollToBottom = (scrollBehavior: ScrollBehavior) => {
      scrollable.scrollTo({
        behavior: prefersReducedMotion ? "auto" : scrollBehavior,
        top: scrollable.scrollHeight,
      });
    };

    const handleScroll = () => {
      pinnedRef.current = isAtBottom();
    };

    // Land on the latest content without animating a jump the reader never
    // asked for, then follow along from there.
    scrollToBottom("auto");
    pinnedRef.current = true;

    scrollable.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    const follow = () => {
      if (mode === "always" || pinnedRef.current) scrollToBottom(behavior);
    };

    // A taller transcript (a streamed answer growing, an image finishing its
    // load) resizes the content, while a whole new turn only appends a node —
    // neither fires a "scroll" event, and one observer alone misses one of the
    // two, so both are watched.
    const resizeObserver = new ResizeObserver(follow);
    resizeObserver.observe(scrollable);
    if (content) resizeObserver.observe(content);

    const mutationObserver = new MutationObserver(follow);
    mutationObserver.observe(content ?? scrollable, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      scrollable.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [
    behavior,
    contentRef,
    enabled,
    mode,
    prefersReducedMotion,
    scrollableRef,
  ]);
}
