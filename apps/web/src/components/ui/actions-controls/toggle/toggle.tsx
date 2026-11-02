"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../utils/tailwind/cn";

export const toggleVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-md font-primary text-sm font-medium transition-colors duration-150 ease-in-out",
  {
    defaultVariants: {
      size: "md",
      variant: "default",
    },
    variants: {
      size: {
        lg: "h-10 px-4",
        md: "h-9 px-3",
        sm: "h-8 px-2",
      },
      variant: {
        default:
          "bg-transparent text-foreground hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted aria-pressed:bg-muted",
      },
    },
  },
);

export type ToggleVariantProps = VariantProps<typeof toggleVariants>["variant"];
export type ToggleSizeProps = VariantProps<typeof toggleVariants>["size"];

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Pressed state, for controlled usage. */
  pressed?: boolean;
  /** Initial pressed state, for uncontrolled usage. @default false */
  defaultPressed?: boolean;
  /** Called with the next pressed state whenever it changes. */
  onPressedChange?: (pressed: boolean) => void;
  /**
   * Visual style.
   * @default "default"
   */
  variant?: ToggleVariantProps;
  /**
   * Size, following the shadcn/ui scale.
   * @default "md"
   */
  size?: ToggleSizeProps;
}

/**
 * Two-state on/off button (WAI-ARIA `aria-pressed` toggle button pattern) —
 * e.g. bold/italic in a formatting toolbar. For a connected set of
 * mutually-exclusive or multi-select toggles, use `ToggleGroup` instead,
 * which shares this component's `toggleVariants`.
 * @example
 * ```tsx
 * <Toggle aria-label="Bold" defaultPressed={false}>
 *   <Icon icon={Bold} size="sm" />
 * </Toggle>
 * ```
 */
export function Toggle({
  pressed,
  defaultPressed = false,
  onPressedChange,
  variant,
  size,
  className,
  onClick,
  ...props
}: ToggleProps) {
  const [uncontrolledPressed, setUncontrolledPressed] =
    React.useState(defaultPressed);
  const isControlled = pressed !== undefined;
  const isPressed = isControlled ? pressed : uncontrolledPressed;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const next = !isPressed;
    if (!isControlled) setUncontrolledPressed(next);
    onPressedChange?.(next);
  };

  return (
    <button
      aria-pressed={isPressed}
      className={cn(
        toggleVariants({
          size,
          variant,
        }),
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        className,
      )}
      data-state={isPressed ? "on" : "off"}
      onClick={handleClick}
      type="button"
      {...props}
    />
  );
}
