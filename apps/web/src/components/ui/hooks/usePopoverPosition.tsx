"use client";

import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";

const DEFAULT_GAP = 16;

/**
 * The closed style, one shared object: setting it again is the same value, so React bails out instead of re-rendering. A fresh object on
 * every closed mount re-rendered each picker of a table (one per row), and with the table remounting its cells that chained into
 * "Maximum update depth exceeded".
 */
const HIDDEN_STYLE: CSSProperties = {
  opacity: 0,
  pointerEvents: "none",
  position: "fixed",
};

/** Same position as before: keeps the previous object so scroll/resize events that change nothing do not re-render. */
const samePosition = (a: CSSProperties, b: CSSProperties): boolean =>
  a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.position === b.position && a.zIndex === b.zIndex;

/**
 * Fixed-position style for a portaled popover anchored to a trigger, flipping above the trigger
 * when there isn't room below and clamping to the viewport horizontally.
 *
 * The panel starts invisible/off-flow: its real width (e.g. two month panels in a range calendar,
 * or three time columns) is only known once it's actually laid out in the DOM, so the first paint
 * must wait for that measurement instead of guessing from the trigger's (much narrower) width —
 * that guess is what sends the panel to the wrong side on its very first open.
 *
 * @param open Whether the popover is rendered; resets to the hidden style when false.
 * @param triggerRef Element the popover is anchored to.
 * @param contentRef The popover panel itself, measured to decide side and clamping.
 * @param options.gap Pixels between trigger and panel, also the minimum viewport inset. @default 16
 */
export function usePopoverPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  options?: {
    gap?: number;
  },
): CSSProperties {
  const gap = options?.gap ?? DEFAULT_GAP;
  const [style, setStyle] = useState<CSSProperties>(HIDDEN_STYLE);

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const contentWidth = content.offsetWidth;
    const contentHeight = content.offsetHeight;

    const left = Math.min(
      rect.left,
      Math.max(gap, viewportWidth - gap - contentWidth),
    );

    const spaceBelow = viewportHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward = spaceBelow < contentHeight && spaceAbove > spaceBelow;

    const next: CSSProperties =
      openUpward
        ? {
            bottom: viewportHeight - rect.top + gap,
            left,
            position: "fixed",
            zIndex: 9999,
          }
        : {
            left,
            position: "fixed",
            top: rect.bottom + gap,
            zIndex: 9999,
          };
    setStyle(previous => (samePosition(previous, next) ? previous : next));
  }, [
    triggerRef,
    contentRef,
    gap,
  ]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(HIDDEN_STYLE);
      return;
    }
    computePosition();
    window.addEventListener("scroll", computePosition, true);
    window.addEventListener("resize", computePosition);
    return () => {
      window.removeEventListener("scroll", computePosition, true);
      window.removeEventListener("resize", computePosition);
    };
  }, [
    open,
    computePosition,
  ]);

  return style;
}
