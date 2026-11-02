"use client";

import * as React from "react";
import { cn } from "../../utils/tailwind/cn";
import { Tag, type TagColor } from "../tag/tag";

/** Texts rendered by `TagInput`'s subcomponents. Pass `lang` to override any of them. */
export interface TagInputLang {
  /** Validation error once `max` is reached. */
  maxTags: (max: number) => string;
  /** Validation error for a duplicate tag. */
  duplicate: (tag: string) => string;
  /** Live-region announcement after tags are added. */
  added: (tags: string) => string;
  /** Live-region announcement after a tag is removed. */
  removed: (tag: string) => string;
  /** Accessible name of a tag's remove button. */
  removeTag: (tag: string) => string;
}

/** English defaults for `TagInputLang`. */
export const defaultTagInputLang: TagInputLang = {
  added: (tags) => `Added ${tags}`,
  duplicate: (tag) => `"${tag}" is already added.`,
  maxTags: (max) => `You can add up to ${max} tags.`,
  removeTag: (tag) => `Remove ${tag}`,
  removed: (tag) => `Removed ${tag}`,
};

interface TagInputContextValue {
  tags: string[];
  /** Tries to add the text as one or more tags (split on delimiters/newlines). Returns `true` if at least one was added. */
  addTags: (text: string) => boolean;
  removeTag: (index: number) => void;
  inputId: string;
  errorId: string;
  errorText: string | undefined;
  clearError: () => void;
  disabled: boolean;
  addOnBlur: boolean;
  delimiters: readonly string[];
  isFull: boolean;
  tagColor: TagColor;
  announce: string;
  lang: TagInputLang;
}

const TagInputContext = React.createContext<TagInputContextValue | null>(null);

function useTagInputContext() {
  const context = React.useContext(TagInputContext);
  if (!context) {
    throw new Error("TagInput subcomponents must be used within <TagInput>.");
  }
  return context;
}

export interface TagInputProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "lang"> {
  /** Current tags, for controlled usage. */
  value?: string[];
  /**
   * Initial tags, for uncontrolled usage.
   * @default []
   */
  defaultValue?: string[];
  /** Called with the full, new list whenever a tag is added or removed. */
  onValueChange?: (tags: string[]) => void;
  /** Maximum number of tags. Once reached, the field stops accepting input and says so. */
  max?: number;
  /**
   * Allows the same tag more than once. Comparison is case-insensitive when `false`.
   * @default false
   */
  allowDuplicates?: boolean;
  /**
   * Characters that commit the text typed so far as a tag (besides `Enter`, which always does). Also used to split pasted text, together with newlines.
   * @default [","]
   */
  delimiters?: readonly string[];
  /**
   * Commits pending text as a tag when the field loses focus.
   * @default true
   */
  addOnBlur?: boolean;
  /** Checks a tag before it's added. Return `true` to accept it, or a message explaining why it's invalid (shown under the field). */
  validate?: (tag: string) => true | string;
  /** Error text from outside (e.g. a form's own validation). Takes priority over `validate`'s message. */
  errorMessage?: string;
  /**
   * Color of the tags.
   * @default "default"
   */
  tagColor?: TagColor;
  /**
   * Disables the field and every tag's remove button.
   * @default false
   */
  disabled?: boolean;
  /**
   * Texts rendered by this component's subcomponents. Merges over English defaults.
   * @default defaultTagInputLang
   */
  lang?: Partial<TagInputLang>;
}

/**
 * Compound field for free-form tags: type a value and press `Enter` (or a
 * delimiter such as `,`) to turn it into a `Tag`; `Backspace` on an empty
 * input removes the last one; pasted lists are split into tags. It creates
 * values — to *choose* from a list use `Combobox` instead.
 * @example
 * ```tsx
 * <TagInput max={5} onValueChange={setTopics} value={topics}>
 *   <TagInput.Label>Topics</TagInput.Label>
 *   <TagInput.Field placeholder="Add a topic…" />
 * </TagInput>
 * ```
 */
function TagInputRoot({
  value: controlledValue,
  defaultValue = [],
  onValueChange,
  max,
  allowDuplicates = false,
  delimiters = [
    ",",
  ],
  addOnBlur = true,
  validate,
  errorMessage,
  tagColor = "default",
  disabled = false,
  lang,
  className,
  children,
  ...props
}: TagInputProps) {
  const resolvedLang = { ...defaultTagInputLang, ...lang };
  const inputId = React.useId();
  const errorId = `${inputId}-error`;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [validationError, setValidationError] = React.useState<string>();
  const [announce, setAnnounce] = React.useState("");
  const isControlled = controlledValue !== undefined;
  const tags = isControlled ? controlledValue : internalValue;

  const commit = React.useCallback(
    (next: string[]) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [
      isControlled,
      onValueChange,
    ],
  );

  const addTags = React.useCallback(
    (text: string) => {
      const pieces = text
        .split(new RegExp(`[\\n${delimiters.map(escapeForClass).join("")}]`))
        .map((piece) => piece.trim())
        .filter(Boolean);
      if (pieces.length === 0) return false;

      const next = [
        ...tags,
      ];
      const added: string[] = [];
      let error: string | undefined;

      for (const piece of pieces) {
        if (max !== undefined && next.length >= max) {
          error = resolvedLang.maxTags(max);
          break;
        }
        if (
          !allowDuplicates &&
          next.some((tag) => tag.toLowerCase() === piece.toLowerCase())
        ) {
          error = resolvedLang.duplicate(piece);
          continue;
        }
        const result = validate?.(piece) ?? true;
        if (result !== true) {
          error = result;
          continue;
        }
        next.push(piece);
        added.push(piece);
      }

      setValidationError(error);
      if (added.length > 0) {
        commit(next);
        setAnnounce(resolvedLang.added(added.join(", ")));
      }
      return added.length > 0;
    },
    [
      allowDuplicates,
      commit,
      delimiters,
      max,
      resolvedLang,
      tags,
      validate,
    ],
  );

  const removeTag = React.useCallback(
    (index: number) => {
      const removed = tags[index];
      if (removed === undefined) return;
      setValidationError(undefined);
      setAnnounce(resolvedLang.removed(removed));
      commit(tags.filter((_, i) => i !== index));
    },
    [
      commit,
      resolvedLang,
      tags,
    ],
  );

  const errorText = errorMessage ?? validationError;
  const clearError = React.useCallback(() => setValidationError(undefined), []);

  const contextValue = React.useMemo(
    () => ({
      addOnBlur,
      addTags,
      announce,
      clearError,
      delimiters,
      disabled,
      errorId,
      errorText,
      inputId,
      isFull: max !== undefined && tags.length >= max,
      lang: resolvedLang,
      removeTag,
      tagColor,
      tags,
    }),
    [
      addOnBlur,
      addTags,
      announce,
      clearError,
      delimiters,
      disabled,
      errorId,
      errorText,
      inputId,
      max,
      resolvedLang,
      removeTag,
      tagColor,
      tags,
    ],
  );

  return (
    <TagInputContext.Provider value={contextValue}>
      <div
        className={cn("flex flex-col gap-1.5", className)}
        {...props}
      >
        {children}
        {errorText && (
          <p
            className="font-primary text-xs text-destructive"
            id={errorId}
            role="alert"
          >
            {errorText}
          </p>
        )}
        <span
          aria-live="polite"
          className="sr-only"
        >
          {announce}
        </span>
      </div>
    </TagInputContext.Provider>
  );
}

function escapeForClass(character: string) {
  return character.replace(/[\\\]^-]/g, "\\$&");
}

export interface TagInputLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

/** Label of the field; clicking it focuses the text input. */
function TagInputLabel({ className, ...props }: TagInputLabelProps) {
  const { inputId } = useTagInputContext();
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: wired to the field's input through `htmlFor`.
    <label
      className={cn(
        "font-primary text-sm font-medium text-foreground",
        className,
      )}
      htmlFor={inputId}
      {...props}
    />
  );
}

export interface TagInputFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange"
  > {
  /** Classes for the bordered container that holds the tags and the input. */
  containerClassName?: string;
}

/** The bordered box: the current tags followed by the text input. Clicking anywhere in it focuses the input. */
function TagInputField({
  className,
  containerClassName,
  placeholder,
  onKeyDown,
  onBlur,
  onPaste,
  ...props
}: TagInputFieldProps) {
  const {
    tags,
    addTags,
    removeTag,
    inputId,
    errorId,
    errorText,
    clearError,
    disabled,
    addOnBlur,
    delimiters,
    isFull,
    tagColor,
    lang,
  } = useTagInputContext();
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commitDraft = () => {
    if (!draft.trim()) {
      setDraft("");
      return;
    }
    // Keep the text on failure so the user can fix it.
    if (addTags(draft)) setDraft("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === "Enter" || delimiters.includes(event.key)) {
      // Enter must never submit a surrounding form while tags are being typed.
      if (event.key === "Enter" && !draft.trim()) return;
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented) return;
    const text = event.clipboardData.getData("text");
    const splits = new RegExp(
      `[\\n${delimiters.map(escapeForClass).join("")}]`,
    ).test(text);
    if (!splits) return;
    event.preventDefault();
    addTags(draft + text);
    setDraft("");
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
    if (addOnBlur) commitDraft();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: forwards a click on the box's padding to the input, which stays the real keyboard target.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same — keyboard users interact with the input itself.
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 transition-colors duration-150 ease-in-out focus-within:border-ring",
        disabled && "cursor-not-allowed opacity-50",
        errorText && "border-destructive",
        containerClassName,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <Tag
          color={tagColor}
          disabled={disabled}
          // biome-ignore lint/suspicious/noArrayIndexKey: with `allowDuplicates` the same text can appear twice, so the position is part of the identity.
          key={`${tag}-${index}`}
          size="sm"
        >
          <Tag.Text>{tag}</Tag.Text>
          <Tag.Remove
            label={lang.removeTag(tag)}
            onClick={(event) => {
              event.stopPropagation();
              removeTag(index);
              inputRef.current?.focus();
            }}
          />
        </Tag>
      ))}
      <input
        aria-describedby={errorText ? errorId : undefined}
        aria-invalid={errorText ? true : undefined}
        autoComplete="off"
        className={cn(
          "min-w-24 flex-1 bg-transparent px-1 py-0.5 font-primary text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          className,
        )}
        disabled={disabled}
        id={inputId}
        onBlur={handleBlur}
        onChange={(event) => {
          setDraft(event.target.value);
          if (errorText) clearError();
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={tags.length === 0 ? placeholder : undefined}
        readOnly={isFull}
        ref={inputRef}
        type="text"
        value={draft}
        {...props}
      />
    </div>
  );
}

export const TagInput = Object.assign(TagInputRoot, {
  Field: TagInputField,
  Label: TagInputLabel,
});
