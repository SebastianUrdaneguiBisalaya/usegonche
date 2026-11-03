"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { File } from "lucide-react";
import * as React from "react";

import { cn } from "../../utils/tailwind/cn";
import { type FileFormat, KIND_COLOR, resolveFileFormat } from "./format";

export type { FileFormat, FileIconKind } from "./format";
export {
  getExtension,
  getFileName,
  KNOWN_EXTENSIONS,
  resolveFileFormat,
} from "./format";

interface FileIconContextValue {
  /** Format resolved by `Root`, or `null` when nothing identified the file. */
  format: FileFormat | null;
}

const FileIconContext = React.createContext<FileIconContextValue | null>(null);

function useFileIconContext() {
  const context = React.useContext(FileIconContext);
  if (!context)
    throw new Error(
      "FileIcon subcomponents must be used within <FileIcon.Root>.",
    );
  return context;
}

// The whole glyph is drawn in `em`, off a font size derived from the box: change the size and the badge
// scales with the sheet instead of drifting out of proportion.
const fileIconVariants = cva(
  "relative inline-block shrink-0 align-middle text-[length:calc(var(--file-icon-size)/5)] [--file-icon-size:3.5rem] size-(--file-icon-size)",
  {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        lg: "[--file-icon-size:5rem]",
        md: "[--file-icon-size:3.5rem]",
        sm: "[--file-icon-size:2.5rem]",
        xl: "[--file-icon-size:7rem]",
      },
    },
  },
);

export type FileIconSize = NonNullable<
  VariantProps<typeof fileIconVariants>["size"]
>;

export interface FileIconRootProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /**
   * What to read the format from: a URL (`https://cdn.example.com/q3.pdf?v=2`), a path, or a bare file name.
   * Query strings and fragments are ignored, and a `data:` URL is read by its MIME type. Leave it out and pass
   * `format` or `mimeType` instead when you only have those.
   */
  file?: string;
  /**
   * MIME type to fall back on when `file` has no usable extension — typically `File.type` from an upload.
   * The extension wins when both are present, because browsers often report `""` or
   * `application/octet-stream` for formats they don't know.
   */
  mimeType?: string;
  /**
   * Extension to show, with or without the dot (`"pdf"`, `".xlsx"`). Beats everything else, for when the
   * name is wrong or absent — a blob URL, an extensionless download link.
   */
  format?: string;
  /**
   * Size of the icon. Sheet and badge scale together.
   * @default "md"
   */
  size?: FileIconSize;
  /**
   * Accessible name. The icon is announced as an image with this text; by default it reads as the format's
   * label plus "file" (`"PDF file"`). Pass `aria-hidden` instead when a name sits next to the icon and
   * repeating the format would be noise.
   */
  label?: string;
  /**
   * Replaces the default pieces. Without children the root renders `FileIcon.Sheet` and `FileIcon.Badge`
   * for you.
   */
  children?: React.ReactNode;
}

/**
 * File icon — a document sheet with a colored format badge (`PDF`, `JPG`, `XLSX`…), resolved from a URL, a
 * path, a file name, a MIME type or an explicit extension. Over 150 extensions are recognised and grouped
 * into families that share a color: images purple, PDFs red, documents blue, spreadsheets green,
 * presentations orange, video pink, audio teal, archives amber, code slate, text gray. An extension nobody
 * knows still gets a badge with its own letters, in the neutral "other" color; a name with no extension at
 * all gets a plain sheet.
 *
 * Detection is by name and MIME type, not by sniffing file contents — which is what you want for an icon in
 * a list, because it's synchronous and needs nothing but the string you already have.
 *
 * The sheet is a Lucide `File` in a neutral outline; the badge colors are the `--file-*` tokens in
 * `src/index.css`. Those are a legend, like the chart palette, so they are the one place file chrome carries
 * hue.
 *
 * ```tsx
 * <FileIcon.Root file="https://cdn.example.com/reports/q3.pdf?v=2" />
 * ```
 */
function FileIconRoot({
  file,
  mimeType,
  format,
  size,
  label,
  className,
  children,
  ...props
}: FileIconRootProps) {
  const resolved = React.useMemo(
    () =>
      resolveFileFormat({
        format,
        mimeType,
        source: file,
      }),
    [
      file,
      format,
      mimeType,
    ],
  );
  const value = React.useMemo<FileIconContextValue>(
    () => ({
      format: resolved,
    }),
    [
      resolved,
    ],
  );

  // Announced as one image named after the format — unless the caller hides it because a name sits beside it.
  const hidden =
    props["aria-hidden"] === true || props["aria-hidden"] === "true";
  const semantics = hidden
    ? {}
    : {
        "aria-label": label ?? (resolved ? `${resolved.label} file` : "File"),
        role: "img",
      };

  return (
    <FileIconContext.Provider value={value}>
      <span
        className={cn(
          fileIconVariants({
            size,
          }),
          className,
        )}
        data-file-kind={resolved?.kind ?? "none"}
        data-file-label={resolved?.label}
        {...semantics}
        {...props}
      >
        {children ?? (
          <>
            <Sheet />
            <Badge />
          </>
        )}
      </span>
    </FileIconContext.Provider>
  );
}

export interface FileIconSheetProps
  extends React.SVGAttributes<SVGSVGElement> {}

/**
 * The document sheet — a folded-corner outline drawn with Lucide's `File`, in the neutral border ink so it
 * works on either theme. It fills the root and is where the badge anchors.
 */
function Sheet({ className, ...props }: FileIconSheetProps) {
  return (
    <File
      absoluteStrokeWidth={false}
      aria-hidden="true"
      className={cn("absolute inset-0 size-full text-border-strong", className)}
      data-file-sheet=""
      strokeWidth={0.9}
      {...props}
    />
  );
}

export interface FileIconBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

/**
 * The colored chip with the format's letters, overlapping the sheet's left edge. Reads its format and color
 * from `FileIcon.Root`. Renders nothing when there is no format to show.
 */
function Badge({ className, style, ...props }: FileIconBadgeProps) {
  const context = useFileIconContext();
  const resolved = context.format;
  if (!resolved) return null;

  return (
    <span
      className={cn(
        "absolute top-[42%] left-[6%] inline-flex translate-x-[-10%] items-center rounded-[0.3em] px-[0.5em] py-[0.25em] font-primary text-[1em] font-bold leading-none tracking-[0.02em] text-white",
        className,
      )}
      data-file-badge=""
      style={{
        backgroundColor: KIND_COLOR[resolved.kind],
        ...style,
      }}
      {...props}
    >
      {resolved.label}
    </span>
  );
}

export const FileIcon = {
  Badge,
  Root: FileIconRoot,
  Sheet,
};
