"use client";

import * as React from "react";
import { cn } from "../../utils/tailwind/cn";
import {
  type ToggleSizeProps,
  type ToggleVariantProps,
  toggleVariants,
} from "../toggle/toggle";

type ToggleGroupSingleProps = {
  type?: "single";
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
};

type ToggleGroupMultipleProps = {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export type ToggleGroupProps = (
  | ToggleGroupSingleProps
  | ToggleGroupMultipleProps
) & {
  children: React.ReactNode;
  /** Applied to every `ToggleGroup.Item`. @default "default" */
  variant?: ToggleVariantProps;
  /** Applied to every `ToggleGroup.Item`. @default "md" */
  size?: ToggleSizeProps;
  disabled?: boolean;
  className?: string;
};

interface ToggleGroupContextValue {
  readonly isSelected: (value: string) => boolean;
  readonly toggle: (value: string) => void;
  readonly variant: ToggleVariantProps;
  readonly size: ToggleSizeProps;
  readonly disabled: boolean;
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(
  null,
);

const EMPTY_VALUES: string[] = [];

function useToggleGroupContext() {
  const context = React.useContext(ToggleGroupContext);
  if (!context) {
    throw new Error("ToggleGroup.Item must be used within <ToggleGroup>.");
  }
  return context;
}

/**
 * Compound, connected set of `Toggle`s. `type="single"` behaves like a radio
 * group (selecting one clears the rest, and can be cleared entirely by
 * re-selecting it); `type="multiple"` (the Radix/shadcn naming) lets any
 * number stay pressed at once. Pair with `ButtonGroup`'s classes (or wrap in
 * one) for the merged-border segmented look.
 * @example
 * ```tsx
 * <ToggleGroup defaultValue="center" type="single">
 *   <ToggleGroup.Item aria-label="Align left" value="left"><Icon icon={AlignLeft} size="sm" /></ToggleGroup.Item>
 *   <ToggleGroup.Item aria-label="Align center" value="center"><Icon icon={AlignCenter} size="sm" /></ToggleGroup.Item>
 * </ToggleGroup>
 * ```
 */
function ToggleGroupRoot(props: ToggleGroupProps) {
  const {
    children,
    variant = "default",
    size = "md",
    disabled = false,
    className,
  } = props;
  const multiple = props.type === "multiple";

  const [uncontrolledSingle, setUncontrolledSingle] = React.useState<
    string | null
  >(
    !multiple ? ((props as ToggleGroupSingleProps).defaultValue ?? null) : null,
  );
  const [uncontrolledMultiple, setUncontrolledMultiple] = React.useState<
    string[]
  >(multiple ? ((props as ToggleGroupMultipleProps).defaultValue ?? []) : []);

  const isSingleControlled = !multiple && "value" in props;
  const isMultipleControlled = multiple && "value" in props;

  const singleValue = isSingleControlled
    ? ((props as ToggleGroupSingleProps).value ?? null)
    : uncontrolledSingle;
  const multipleValue = isMultipleControlled
    ? ((props as ToggleGroupMultipleProps).value ?? EMPTY_VALUES)
    : uncontrolledMultiple;

  const onSingleChange = (props as ToggleGroupSingleProps).onValueChange;
  const onMultipleChange = (props as ToggleGroupMultipleProps).onValueChange;

  const toggle = React.useCallback(
    (itemValue: string) => {
      if (multiple) {
        const next = multipleValue.includes(itemValue)
          ? multipleValue.filter((v) => v !== itemValue)
          : [
              ...multipleValue,
              itemValue,
            ];
        if (!isMultipleControlled) setUncontrolledMultiple(next);
        onMultipleChange?.(next);
        return;
      }

      const next = singleValue === itemValue ? null : itemValue;
      if (!isSingleControlled) setUncontrolledSingle(next);
      onSingleChange?.(next);
    },
    [
      multiple,
      multipleValue,
      singleValue,
      isMultipleControlled,
      isSingleControlled,
      onMultipleChange,
      onSingleChange,
    ],
  );

  const isSelected = React.useCallback(
    (itemValue: string) =>
      multiple ? multipleValue.includes(itemValue) : singleValue === itemValue,
    [
      multiple,
      multipleValue,
      singleValue,
    ],
  );

  const contextValue = React.useMemo<ToggleGroupContextValue>(
    () => ({
      disabled,
      isSelected,
      size,
      toggle,
      variant,
    }),
    [
      disabled,
      isSelected,
      size,
      toggle,
      variant,
    ],
  );

  return (
    <ToggleGroupContext.Provider value={contextValue}>
      <div
        className={cn("flex w-fit items-center gap-1", className)}
        role="group"
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleGroupItemProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "value" | "onChange"
  > {
  /** Value this item toggles; must be unique within the group. */
  value: string;
}

/** One pressable option inside a `ToggleGroup`. */
function ToggleGroupItem({
  value,
  disabled: itemDisabled,
  className,
  ...props
}: ToggleGroupItemProps) {
  const { isSelected, toggle, variant, size, disabled } =
    useToggleGroupContext();
  const pressed = isSelected(value);

  return (
    <button
      aria-pressed={pressed}
      className={cn(
        toggleVariants({
          size,
          variant,
        }),
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        className,
      )}
      data-state={pressed ? "on" : "off"}
      disabled={disabled || itemDisabled}
      onClick={() => toggle(value)}
      type="button"
      {...props}
    />
  );
}

export const ToggleGroup = Object.assign(ToggleGroupRoot, {
  Item: ToggleGroupItem,
});
