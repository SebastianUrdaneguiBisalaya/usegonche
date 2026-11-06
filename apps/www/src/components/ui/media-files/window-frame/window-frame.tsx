"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useState,
} from "react";
import { cn } from "../../utils/tailwind/cn";

type WindowFrameContextValue = {
  readonly titleId: string;
  readonly registerTitle: () => () => void;
};

const WindowFrameContext = createContext<WindowFrameContextValue | null>(null);

function useWindowFrameContext(): WindowFrameContextValue {
  const context = useContext(WindowFrameContext);
  if (!context) {
    throw new Error(
      "WindowFrame compound components must be used inside <WindowFrame.Root>.",
    );
  }
  return context;
}

export interface WindowFrameRootProps {
  /** The frame's pieces: usually a `WindowFrame.TitleBar` followed by a `WindowFrame.Content`. */
  readonly children: ReactNode;
  /** Extra classes for the outer frame, e.g. a fixed width (`w-[40rem]`) or `w-full`. */
  readonly className?: string;
  /**
   * Accessible name for the whole frame. Only needed when no
   * `WindowFrame.Title` is rendered — otherwise the title names the frame.
   */
  readonly "aria-label"?: string;
  /**
   * Draws a soft drop shadow under the window, like a floating macOS window.
   * @default true
   */
  readonly shadow?: boolean;
}

/**
 * Presentational macOS-style window: a rounded frame with a title bar and its
 * red/yellow/green window controls, used to showcase arbitrary content (a
 * desktop screenshot, an image, a live demo) as if it were an app window.
 * Purely decorative chrome — nothing inside it behaves like a real window.
 * Renders a `<figure>` named by `WindowFrame.Title` (or `aria-label`), and
 * hugs its content's width unless a width is given via `className`.
 */
function WindowFrameRoot({
  children,
  className,
  "aria-label": ariaLabel,
  shadow = true,
}: WindowFrameRootProps) {
  const titleId = useId();
  const [titleCount, setTitleCount] = useState(0);

  const registerTitle = () => {
    setTitleCount((count) => count + 1);
    return () => setTitleCount((count) => count - 1);
  };

  return (
    <WindowFrameContext.Provider
      value={{
        registerTitle,
        titleId,
      }}
    >
      <figure
        aria-label={titleCount > 0 ? undefined : ariaLabel}
        aria-labelledby={titleCount > 0 ? titleId : undefined}
        className={cn(
          "m-0 flex w-fit max-w-full flex-col overflow-hidden rounded-xl border border-border bg-background font-primary",
          shadow && "shadow-lg",
          className,
        )}
      >
        {children}
      </figure>
    </WindowFrameContext.Provider>
  );
}

export interface WindowFrameTitleBarProps {
  /** Title bar pieces, in order: `WindowFrame.Controls`, `WindowFrame.Title`, then optional `WindowFrame.Actions`. */
  readonly children: ReactNode;
  /** Extra classes for the title bar. */
  readonly className?: string;
}

/**
 * Top bar of the window. Lays its children out on a three-column grid so
 * `WindowFrame.Title` stays optically centered no matter how wide the
 * controls on the left or the actions on the right are.
 */
function WindowFrameTitleBar({
  children,
  className,
}: WindowFrameTitleBarProps) {
  return (
    <div
      className={cn(
        "grid h-10 w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-border border-b bg-muted px-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface WindowFrameControlsProps {
  /**
   * Renders the three controls as neutral gray dots, the way macOS draws an
   * unfocused (background) window.
   * @default false
   */
  readonly inactive?: boolean;
  /** Extra classes for the controls group. */
  readonly className?: string;
}

const CONTROL_COLORS = [
  "bg-window-close",
  "bg-window-minimize",
  "bg-window-zoom",
] as const;

/**
 * The red/yellow/green close, minimize and zoom dots. Decorative only: they
 * are hidden from assistive technology and never take keyboard focus.
 */
function WindowFrameControls({
  inactive = false,
  className,
}: WindowFrameControlsProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "col-start-1 flex items-center gap-2 justify-self-start",
        className,
      )}
    >
      {CONTROL_COLORS.map((color) => (
        <span
          className={cn(
            "size-3 rounded-full shadow-[inset_0_0_0_0.5px_var(--border-strong)]",
            inactive ? "bg-border-strong" : color,
          )}
          key={color}
        />
      ))}
    </div>
  );
}

export interface WindowFrameTitleProps {
  /** The window title, e.g. an app or document name. */
  readonly children: ReactNode;
  /** Extra classes for the title text. */
  readonly className?: string;
}

/**
 * Centered window title. Also becomes the accessible name of the whole
 * `WindowFrame.Root` figure.
 */
function WindowFrameTitle({ children, className }: WindowFrameTitleProps) {
  const { titleId, registerTitle } = useWindowFrameContext();

  // biome-ignore lint/correctness/useExhaustiveDependencies: register once per mount.
  useLayoutEffect(() => registerTitle(), []);

  return (
    <span
      className={cn(
        "col-start-2 min-w-0 truncate text-center font-medium text-muted-foreground text-xs",
        className,
      )}
      id={titleId}
    >
      {children}
    </span>
  );
}

export interface WindowFrameActionsProps {
  /** Trailing title bar content, e.g. a small icon button or a badge. */
  readonly children: ReactNode;
  /** Extra classes for the actions group. */
  readonly className?: string;
}

/** Optional right-aligned slot at the end of the title bar. */
function WindowFrameActions({ children, className }: WindowFrameActionsProps) {
  return (
    <div
      className={cn(
        "col-start-3 flex items-center gap-1 justify-self-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface WindowFrameContentProps {
  /** What the window shows: an image, a screenshot, a live demo… */
  readonly children: ReactNode;
  /** Extra classes for the content area, e.g. a fixed height or a background. */
  readonly className?: string;
  /**
   * Adds inner padding. Off by default so an image or screenshot fills the
   * window edge to edge.
   * @default false
   */
  readonly padded?: boolean;
}

/**
 * Window body. Media inside it is rendered as a block so it sits flush with
 * the title bar, without the inline baseline gap under images.
 */
function WindowFrameContent({
  children,
  className,
  padded = false,
}: WindowFrameContentProps) {
  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden bg-background text-foreground [&>img]:block [&>img]:h-auto [&>img]:max-w-full [&>video]:block [&>video]:max-w-full",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Decorative macOS-style window frame (see `WindowFrameRoot`).
 * @example
 * ```tsx
 * <WindowFrame.Root>
 *   <WindowFrame.TitleBar>
 *     <WindowFrame.Controls />
 *     <WindowFrame.Title>Desktop</WindowFrame.Title>
 *   </WindowFrame.TitleBar>
 *   <WindowFrame.Content>
 *     <img alt="Desktop screenshot" src="/desktop.png" />
 *   </WindowFrame.Content>
 * </WindowFrame.Root>
 * ```
 */
export const WindowFrame = {
  Actions: WindowFrameActions,
  Content: WindowFrameContent,
  Controls: WindowFrameControls,
  Root: WindowFrameRoot,
  Title: WindowFrameTitle,
  TitleBar: WindowFrameTitleBar,
};
