"use client";

import {
  createUploader,
  type Uploader,
  type UploadResult,
} from "@upflowi/core";
import { createS3Provider } from "@upflowi/provider-s3";
import { createXhrTransport } from "@upflowi/transport-xhr";
import { AlertCircle, CheckCircle2, UploadCloud, X } from "lucide-react";
import * as React from "react";
import { Button } from "../../actions-controls/button/button";
import { Icon } from "../../foundations/icon/icon";
import { Loader } from "../../foundations/loader/loader";
import { Image } from "../../media-files/image/image";
import {
  describeAccept,
  fileKindIcon,
  formatFileSize,
  getFileKind,
  matchesAccept,
} from "../../utils/files/fileTypes";
import { cn } from "../../utils/tailwind/cn";

const MB = 1024 * 1024;
const DEFAULT_MAX_SIZE = 5 * MB;
const DEFAULT_CHUNK_SIZE = 8 * MB;
const DEFAULT_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

type SingleUploadState =
  | {
      status: "idle";
    }
  | {
      status: "uploading";
      progress: number;
    }
  | {
      status: "done";
      url: string;
      file?: File;
    }
  | {
      status: "error";
      message: string;
    };

/** One file of a multi-file dropzone, from the moment it is picked until it is removed. */
interface UploadDropzoneItem {
  id: string;
  file: File;
  status: "uploading" | "done" | "error";
  progress: number;
  url?: string;
  message?: string;
}

function formatLimit(bytes: number) {
  return bytes % MB === 0 ? `${bytes / MB} MB` : formatFileSize(bytes);
}

/**
 * Config for `UploadDropzone.Root`'s `engine` prop: wires the dropzone to `@upflowi/core` instead of a
 * hand-rolled `onUpload`. Files move over `@upflowi/transport-xhr` as S3 multipart transfers driven by
 * `@upflowi/provider-s3`, against presigned URLs your own backend signs — this component and `provider-s3`
 * never see AWS credentials. Mutually exclusive with `onUpload`: pass one or the other.
 */
export interface UploadDropzoneEngineConfig {
  /** Presigned-URL callback for each S3 multipart operation, passed straight to `createS3Provider`. */
  getPresignedUrl: Parameters<typeof createS3Provider>[0]["getPresignedUrl"];
  /**
   * Resolves the public URL to show once a file's transfer completes.
   * @default (file, result) => result.location ?? ""
   */
  getPublicUrl?: (file: File, result: UploadResult) => string;
  /**
   * Files transferred at once.
   * @default 3
   */
  concurrency?: number;
  /**
   * Part size for multipart transfers, in bytes.
   * @default 8 * 1024 * 1024 (8 MiB)
   */
  chunkSize?: number;
}

/**
 * Builds an `onUpload(file, onProgress)` compatible with `UploadDropzone.Root` from an `@upflowi/core`
 * engine config. The underlying `Uploader` is created once (on the first file) and reused for every
 * subsequent file; changing `engine`'s identity after that has no effect. Cancels every tracked transfer
 * on unmount.
 */
function useEngineUpload(
  engine: UploadDropzoneEngineConfig | undefined,
  cancelledMessage: string,
) {
  const uploaderRef = React.useRef<Uploader | null>(null);

  React.useEffect(() => {
    return () => uploaderRef.current?.cancel();
  }, []);

  return React.useCallback(
    (file: File, onProgress: (percent: number) => void) =>
      new Promise<string>((resolve, reject) => {
        if (!engine) {
          reject(
            new Error(
              "UploadDropzone.Root needs `onUpload` or `engine` to upload files.",
            ),
          );
          return;
        }

        uploaderRef.current ??= createUploader({
          chunkSize: engine.chunkSize ?? DEFAULT_CHUNK_SIZE,
          concurrency: engine.concurrency ?? 3,
          provider: createS3Provider({
            getPresignedUrl: engine.getPresignedUrl,
          }),
          transport: createXhrTransport(),
        });
        const uploader = uploaderRef.current;

        const upload = uploader.add({
          source: {
            fileId: `${Date.now()}-${crypto.randomUUID()}-${file.name}`,
            read: (range) =>
              Promise.resolve(file.slice(range.start, range.end)),
            size: file.size,
          },
        });
        upload.on("progress", (progress) =>
          onProgress(Math.round(progress.percent)),
        );
        upload.on("completed", ({ result }) => {
          resolve(engine.getPublicUrl?.(file, result) ?? result.location ?? "");
        });
        upload.on("failed", ({ error }) => reject(error));
        upload.on("cancelled", () => reject(new Error(cancelledMessage)));
        uploader.start();
      }),
    [
      engine,
    ],
  );
}

/** Texts rendered by `UploadDropzone`'s subcomponents. Pass `lang` to `UploadDropzone.Root` to override any of them. */
export interface UploadDropzoneLang {
  /** Singular noun for the file kind: an image when every accepted type is an image, otherwise a file. */
  noun: { image: string; file: string };
  /** Plural noun for the file kind. */
  nounPlural: { image: string; file: string };
  /** Hint shown while a file is dragged over the zone. */
  dropHere: string;
  /** Idle hint, with the plural noun. */
  dragOrClickPlural: (nounPlural: string) => string;
  /** Idle hint for a single upload. */
  dragOrClick: string;
  /** Accessible name of the zone, with the noun. */
  uploadLabel: (noun: string) => string;
  /** Separator-prefixed max-size hint, e.g. "max. 5 MB". */
  maxSize: (limit: string) => string;
  /** Accessible name of the list of selected files. */
  selectedLabel: (nounPlural: string) => string;
  /** Status line while a single file uploads. */
  uploading: (noun: string) => string;
  /** Accessible name of an item while it uploads. */
  uploadingItem: (name: string) => string;
  /** Error when an image-only zone rejects a file type. */
  invalidImageType: string;
  /** Error when a file type isn't in `accept`. */
  invalidType: (acceptedDescription: string) => string;
  /** Error when a file is larger than `maxSize`. */
  tooLarge: (noun: string, limit: string) => string;
  /** Error when an upload is cancelled. */
  cancelled: string;
  /** Fallback error when an upload fails without a message. */
  uploadFailed: (noun: string) => string;
  /** Fallback error when a delete fails without a message. */
  deleteFailed: (noun: string) => string;
  /** Accessible name of the delete button for a single file. */
  deleteFile: (noun: string) => string;
  /** Accessible name of the button that removes a file from the list. */
  deleteItem: (name: string) => string;
  /** Accessible name of the button that dismisses a failed file. */
  dismissItem: (name: string) => string;
  /** Alt text of the preview image. */
  preview: string;
  /** Status shown on a file that finished uploading. */
  uploaded: string;
  /** Notice shown when the file limit is reached. */
  maxFiles: (max: number, nounPlural: string) => string;
}

/** English defaults for `UploadDropzoneLang`. */
export const defaultUploadDropzoneLang: UploadDropzoneLang = {
  cancelled: "Upload cancelled.",
  deleteFailed: (noun) => `Error deleting the ${noun}.`,
  deleteFile: (noun) => `Delete ${noun}`,
  deleteItem: (name) => `Delete ${name}`,
  dismissItem: (name) => `Dismiss ${name}`,
  dragOrClick: "Drag or click to upload",
  dragOrClickPlural: (plural) => `Drag ${plural} or click to upload`,
  dropHere: "Drop here",
  invalidImageType: "The file must be an image (PNG, JPG or WEBP).",
  invalidType: (accepted) => `The file must be of type ${accepted}.`,
  maxSize: (limit) => `max. ${limit}`,
  noun: {
    file: "file",
    image: "image",
  },
  nounPlural: {
    file: "files",
    image: "images",
  },
  preview: "Preview",
  uploaded: "Uploaded",
  maxFiles: (max, nounPlural) => `You can only upload ${max} ${nounPlural} in total.`,
  selectedLabel: (plural) => `${plural[0]?.toUpperCase()}${plural.slice(1)} selected`,
  tooLarge: (noun, limit) => `The ${noun} can't exceed ${limit}.`,
  uploadFailed: (noun) => `Error uploading the ${noun}.`,
  uploadLabel: (noun) => `Upload ${noun}`,
  uploading: (noun) => `Uploading ${noun}`,
  uploadingItem: (name) => `Uploading ${name}`,
};

interface UploadDropzoneContextValue {
  lang: UploadDropzoneLang;
  isMulti: boolean;
  compact: boolean;
  imagesOnly: boolean;
  noun: string;
  nounPlural: string;
  acceptedDescription: string;
  acceptsAnything: boolean;
  accept: string[];
  maxSize: number;
  maxFiles: number;
  canDelete: boolean;
  state: SingleUploadState;
  items: UploadDropzoneItem[];
  notice: string | null;
  isDragActive: boolean;
  isDeleting: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasFile: boolean;
  currentUrl: string | undefined;
  doneFile: File | undefined;
  previewIsImage: boolean;
  displayError: string | undefined;
  showDropzone: boolean;
  openFilePicker: () => void;
  handleDelete: () => void;
  removeItem: (item: UploadDropzoneItem) => void;
  handleDragOver: (event: React.DragEvent) => void;
  handleDragLeave: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDropzoneKeyDown: (event: React.KeyboardEvent) => void;
}

const UploadDropzoneContext =
  React.createContext<UploadDropzoneContextValue | null>(null);

function useUploadDropzoneContext() {
  const context = React.useContext(UploadDropzoneContext);
  if (!context) {
    throw new Error(
      "UploadDropzone subcomponents must be used within <UploadDropzone.Root>.",
    );
  }
  return context;
}

interface UploadDropzoneUploadProps {
  /**
   * Performs the actual upload and resolves with the final public URL, calling `onProgress` with 0-100
   * as it goes. This component owns none of the upload mechanics — only the drag/drop UI and idle/
   * uploading/done/error state around it. With `maxFiles > 1` it is called once per file, concurrently.
   * Mutually exclusive with `engine`; pass exactly one.
   */
  onUpload?: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<string>;
  /** Uploads through `@upflowi/core` instead of `onUpload`. Mutually exclusive; pass exactly one. See `UploadDropzoneEngineConfig`. */
  engine?: UploadDropzoneEngineConfig;
}

export type UploadDropzoneProps = UploadDropzoneUploadProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, "onError" | "lang"> & {
    /**
     * Texts rendered by this component's subcomponents. Merges over English defaults.
     * @default defaultUploadDropzoneLang
     */
    lang?: Partial<UploadDropzoneLang>;
    /** Called with the resulting URL (and the uploaded `File`) once the upload resolves. */
    onUploadComplete?: (url: string, file: File) => void;
    /** Deletes a previously uploaded file. Omit to hide the delete button. */
    onDelete?: (url: string) => Promise<void>;
    /** URL of an already-uploaded image, for controlled/edit usage. Only used when `maxFiles` is `1`. */
    existingUrl?: string;
    /** External error to display in `UploadDropzone.Error` (e.g. a server-side validation error), alongside any the component raises itself. */
    error?: string;
    /**
     * Max size of each file in bytes.
     * @default 5 * 1024 * 1024 (5 MB)
     */
    maxSize?: number;
    /**
     * What the dropzone accepts, in the same forms as `<input accept>`: exact MIME types (`"application/pdf"`),
     * MIME wildcards (`"image/*"`) and extensions (`".csv"`). Files that don't match are rejected with an error.
     * @default ["image/png", "image/jpeg", "image/webp"]
     */
    accept?: string[];
    /**
     * How many files it takes. `1` keeps the single-file preview (`UploadDropzone.Preview`); more than `1`
     * lets the user pick or drop several at once and shows a per-file progress list (`UploadDropzone.List`),
     * until the limit is reached.
     * @default 1
     */
    maxFiles?: number;
    /** Overrides the auto-generated list of accepted formats shown by `UploadDropzone.Trigger` (e.g. `"PDF, XLSX, CSV"`). */
    acceptLabel?: string;
    /**
     * Shorter `UploadDropzone.Trigger` laid out as a single row, for drawers and tight spaces.
     * @default false
     */
    compact?: boolean;
  };

/**
 * Compound file dropzone: drag-and-drop or click-to-browse, with upload progress, a preview, and
 * delete — composed from `UploadDropzone.Trigger`, `.Preview`, `.Progress`, `.List`, `.Notice` and
 * `.Error`, sharing state through this Root's Context. Upload mechanics are injected via `onUpload`
 * (bring your own presigned URLs, direct-to-storage PUT, your own API — whatever your app uses) or
 * `engine` (uses `@upflowi/core` + `@upflowi/transport-xhr` + `@upflowi/provider-s3` for you). `accept`
 * and `maxFiles` make it work for any file type, single or multiple; its defaults (images, one file)
 * are unchanged from when this was image-only.
 * @example
 * ```tsx
 * <UploadDropzone.Root maxFiles={5} onUpload={uploadToStorage}>
 *   <UploadDropzone.Label>Adjuntos</UploadDropzone.Label>
 *   <UploadDropzone.Hint>Hasta 5 archivos, 5&nbsp;MB cada uno.</UploadDropzone.Hint>
 *   <UploadDropzone.Preview />
 *   <UploadDropzone.Progress />
 *   <UploadDropzone.Trigger />
 *   <UploadDropzone.List />
 *   <UploadDropzone.Notice />
 *   <UploadDropzone.Error />
 * </UploadDropzone.Root>
 * ```
 */
function UploadDropzoneRoot({
  onUpload,
  engine,
  onUploadComplete,
  onDelete,
  existingUrl,
  error,
  className,
  maxSize = DEFAULT_MAX_SIZE,
  accept = DEFAULT_ACCEPT,
  maxFiles = 1,
  acceptLabel,
  compact = false,
  lang,
  children,
  ...props
}: UploadDropzoneProps) {
  const resolvedLang = { ...defaultUploadDropzoneLang, ...lang };
  const engineUpload = useEngineUpload(engine, resolvedLang.cancelled);
  const upload = onUpload ?? engineUpload;

  const isMulti = maxFiles > 1;
  const imagesOnly = accept.every((entry) =>
    entry.trim().toLowerCase().startsWith("image/"),
  );
  const acceptedDescription = acceptLabel ?? describeAccept(accept);
  // `*/*` isn't a token browsers understand in `<input accept>`; leaving the attribute off means "anything".
  const acceptsAnything = accept.some((entry) =>
    [
      "*/*",
      "*",
    ].includes(entry.trim()),
  );
  const kindKey = imagesOnly ? "image" : "file";
  const noun = resolvedLang.noun[kindKey];
  const nounPlural = resolvedLang.nounPlural[kindKey];

  const [state, setState] = React.useState<SingleUploadState>({
    status: "idle",
  });
  const [items, setItems] = React.useState<UploadDropzoneItem[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const doneFile = state.status === "done" ? state.file : undefined;
  const currentUrl = state.status === "done" ? state.url : existingUrl;
  const hasFile = Boolean(currentUrl);
  // A file we uploaded ourselves is previewed by its real type; a bare `existingUrl` is assumed to be an image.
  const previewIsImage = doneFile
    ? getFileKind({
        mimeType: doneFile.type,
        name: doneFile.name,
      }) === "image"
    : true;

  const validate = React.useCallback(
    (file: File): string | null => {
      if (!matchesAccept(file, accept)) {
        return imagesOnly
          ? resolvedLang.invalidImageType
          : resolvedLang.invalidType(acceptedDescription);
      }
      if (file.size > maxSize) {
        return resolvedLang.tooLarge(noun, formatLimit(maxSize));
      }
      return null;
    },
    [
      accept,
      acceptedDescription,
      imagesOnly,
      maxSize,
    ],
  );

  const handleUpload = React.useCallback(
    async (file: File | undefined) => {
	  if (file === undefined) return;
      const invalid = validate(file);
      if (invalid) {
        setState({
          message: invalid,
          status: "error",
        });
        return;
      }

      setState({
        progress: 0,
        status: "uploading",
      });
      try {
        const url = await upload(file, (progress) =>
          setState({
            progress,
            status: "uploading",
          }),
        );
        setState({
          file,
          status: "done",
          url,
        });
        onUploadComplete?.(url, file);
      } catch (err) {
        setState({
          message:
            err instanceof Error
              ? err.message
              : resolvedLang.uploadFailed(noun),
          status: "error",
        });
      }
    },
    [
      imagesOnly,
      upload,
      onUploadComplete,
      validate,
    ],
  );

  const patchItem = React.useCallback(
    (id: string, patch: Partial<UploadDropzoneItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleFiles = React.useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      if (!isMulti) {
        void handleUpload(files[0]);
        return;
      }

      setNotice(null);
      const used = items.filter((item) => item.status !== "error").length;
      const remaining = Math.max(maxFiles - used, 0);
      const accepted = files.slice(0, remaining);
      if (files.length > remaining) {
        setNotice(resolvedLang.maxFiles(maxFiles, nounPlural));
      }

      const created: UploadDropzoneItem[] = accepted.map((file) => {
        const invalid = validate(file);
        return {
          file,
          id: crypto.randomUUID(),
          message: invalid ?? undefined,
          progress: 0,
          status: invalid ? "error" : "uploading",
        };
      });
      setItems((current) => [
        ...current,
        ...created,
      ]);

      for (const item of created) {
        if (item.status === "error") continue;
        upload(item.file, (progress) =>
          patchItem(item.id, {
            progress,
          }),
        )
          .then((url) => {
            patchItem(item.id, {
              progress: 100,
              status: "done",
              url,
            });
            onUploadComplete?.(url, item.file);
          })
          .catch((err: unknown) => {
            patchItem(item.id, {
              message:
                err instanceof Error
                  ? err.message
                  : resolvedLang.uploadFailed(noun),
              status: "error",
            });
          });
      }
    },
    [
      handleUpload,
      isMulti,
      items,
      maxFiles,
      noun,
      nounPlural,
      upload,
      onUploadComplete,
      patchItem,
      validate,
    ],
  );

  const handleDelete = React.useCallback(() => {
    if (!currentUrl || !onDelete) return;
    setIsDeleting(true);
    onDelete(currentUrl)
      .then(() => {
        setState({
          status: "idle",
        });
      })
      .catch((err: unknown) => {
        setState({
          message:
            err instanceof Error
              ? err.message
              : resolvedLang.deleteFailed(noun),
          status: "error",
        });
      })
      .finally(() => setIsDeleting(false));
  }, [
    currentUrl,
    imagesOnly,
    onDelete,
  ]);

  const removeItem = React.useCallback(
    async (item: UploadDropzoneItem) => {
      if (item.status === "done" && item.url && onDelete) {
        patchItem(item.id, {
          message: undefined,
        });
        try {
          await onDelete(item.url);
        } catch (err) {
          patchItem(item.id, {
            message:
              err instanceof Error
                ? err.message
                : resolvedLang.deleteFailed(noun),
          });
          return;
        }
      }
      setItems((current) =>
        current.filter((candidate) => candidate.id !== item.id),
      );
      setNotice(null);
    },
    [
      noun,
      onDelete,
      patchItem,
    ],
  );

  const openFilePicker = React.useCallback(() => {
    inputRef.current?.click();
  }, []);
  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  }, []);
  const handleDragLeave = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);
  }, []);
  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragActive(false);
      handleFiles(Array.from(event.dataTransfer.files));
    },
    [
      handleFiles,
    ],
  );
  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      handleFiles(files);
    },
    [
      handleFiles,
    ],
  );
  const handleDropzoneKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFilePicker();
      }
    },
    [
      openFilePicker,
    ],
  );

  const displayError = state.status === "error" ? state.message : error;
  const usedSlots = items.filter((item) => item.status !== "error").length;
  const showDropzone = isMulti
    ? usedSlots < maxFiles
    : !hasFile && state.status !== "uploading";

  const contextValue = React.useMemo<UploadDropzoneContextValue>(
    () => ({
      accept,
      lang: resolvedLang,
      acceptedDescription,
      acceptsAnything,
      canDelete: Boolean(onDelete),
      compact,
      currentUrl,
      displayError,
      doneFile,
      handleDelete,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleDropzoneKeyDown,
      handleInputChange,
      hasFile,
      imagesOnly,
      inputRef,
      isDeleting,
      isDragActive,
      isMulti,
      items,
      maxFiles,
      maxSize,
      notice,
      noun,
      nounPlural,
      openFilePicker,
      previewIsImage,
      removeItem,
      showDropzone,
      state,
    }),
    [
      accept,
      acceptedDescription,
      acceptsAnything,
      resolvedLang,
      compact,
      currentUrl,
      displayError,
      doneFile,
      handleDelete,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleDropzoneKeyDown,
      handleInputChange,
      hasFile,
      imagesOnly,
      isDeleting,
      isDragActive,
      isMulti,
      items,
      maxFiles,
      maxSize,
      noun,
      nounPlural,
      notice,
      onDelete,
      openFilePicker,
      previewIsImage,
      removeItem,
      showDropzone,
      state,
    ],
  );

  return (
    <UploadDropzoneContext.Provider value={contextValue}>
      <div
        className={cn("flex flex-col gap-1.5", className)}
        {...props}
      >
        {children}
      </div>
    </UploadDropzoneContext.Provider>
  );
}

export interface UploadDropzoneLabelProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

/** Label shown above the dropzone. */
function UploadDropzoneLabel({
  className,
  ...props
}: UploadDropzoneLabelProps) {
  return (
    <p
      className={cn(
        "text-sm font-normal font-primary text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface UploadDropzoneHintProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

/** Helper text shown under `UploadDropzone.Label`. */
function UploadDropzoneHint({ className, ...props }: UploadDropzoneHintProps) {
  return (
    <p
      className={cn("text-xs font-primary text-muted-foreground", className)}
      {...props}
    />
  );
}

export interface UploadDropzoneTriggerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop"> {}

/** The drag/drop and click-to-browse target. Renders nothing once the file (or file limit) slot is filled. */
function UploadDropzoneTrigger({
  className,
  ...props
}: UploadDropzoneTriggerProps) {
  const {
    accept,
    acceptedDescription,
    acceptsAnything,
    compact,
    displayError,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleDropzoneKeyDown,
    handleInputChange,
    inputRef,
    isDragActive,
    isMulti,
    maxFiles,
    maxSize,
    noun,
    nounPlural,
    openFilePicker,
    showDropzone,
    state,
    lang,
  } = useUploadDropzoneContext();

  if (!showDropzone) return null;

  return (
    <div
      aria-label={lang.uploadLabel(isMulti ? nounPlural : noun)}
      className={cn(
        "flex w-full cursor-pointer rounded-xl border-2 border-dashed",
        compact
          ? "h-16 flex-row items-center gap-3 px-4"
          : "h-30 flex-col items-center justify-center gap-2",
        "transition-all duration-300 ease-in-out",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        isDragActive
          ? "border-foreground bg-muted"
          : "border-border hover:border-foreground/40 hover:bg-muted",
        displayError && "border-destructive",
        className,
      )}
      onClick={openFilePicker}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleDropzoneKeyDown}
      role="button"
      tabIndex={0}
      {...props}
    >
      <input
        accept={acceptsAnything ? undefined : accept.join(",")}
        className="hidden"
        multiple={isMulti}
        onChange={handleInputChange}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      {state.status === "error" && !isMulti ? (
        <Icon
          className="shrink-0 text-destructive"
          icon={AlertCircle}
          size="xl"
        />
      ) : (
        <Icon
          className={cn(
            "shrink-0 transition-transform duration-300 ease-in-out",
            isDragActive
              ? "-translate-y-1.5 text-foreground"
              : "text-muted-foreground",
          )}
          icon={UploadCloud}
          size="xl"
        />
      )}
      <div
        className={cn(
          "px-3",
          compact ? "min-w-0 px-0 text-left" : "text-center",
        )}
      >
        <p className="text-sm font-normal font-primary text-foreground">
          {isDragActive
            ? lang.dropHere
            : isMulti
              ? lang.dragOrClickPlural(nounPlural)
              : lang.dragOrClick}
        </p>
        <p
          className={cn(
            "text-xs font-primary text-muted-foreground",
            compact ? "truncate" : "mt-0.5",
          )}
        >
          {acceptedDescription} · {lang.maxSize(formatLimit(maxSize))}
          {isMulti ? ` · ${maxFiles} ${nounPlural} max.` : ""}
        </p>
      </div>
    </div>
  );
}

export interface UploadDropzonePreviewProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Single-file preview with a delete button. Only renders with `maxFiles={1}`, once a file exists and none is uploading. */
function UploadDropzonePreview({
  className,
  ...props
}: UploadDropzonePreviewProps) {
  const {
    currentUrl,
    canDelete,
    doneFile,
    handleDelete,
    hasFile,
    isDeleting,
    isMulti,
    noun,
    previewIsImage,
    state,
    lang,
  } = useUploadDropzoneContext();

  if (isMulti || !hasFile || state.status === "uploading") return null;

  return (
    <div
      className={cn(
        "group relative h-36 w-full overflow-hidden rounded-xl border border-border",
        className,
      )}
      {...props}
    >
      {previewIsImage ? (
        <Image className="h-full w-full">
          <Image.Img
            alt={lang.preview}
            className="object-contain"
            src={currentUrl}
          />
          <Image.Skeleton />
        </Image>
      ) : (
        doneFile && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted px-6">
            <Icon
              className="text-muted-foreground"
              icon={
                fileKindIcon[
                  getFileKind({
                    mimeType: doneFile.type,
                    name: doneFile.name,
                  })
                ]
              }
              size="xl"
            />
            <p className="max-w-full truncate text-sm font-primary text-foreground">
              {doneFile.name}
            </p>
            <p className="text-xs font-primary text-muted-foreground">
              {formatFileSize(doneFile.size)}
            </p>
          </div>
        )
      )}
      <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/20" />
      {canDelete && (
        <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            disabled={isDeleting}
            onClick={handleDelete}
            size="icon"
            title={lang.deleteFile(noun)}
            type="button"
            variant="secondary"
          >
            {isDeleting ? (
              <Loader size="sm" />
            ) : (
              <Icon
                icon={X}
                size="sm"
              />
            )}
          </Button>
        </div>
      )}
      {state.status === "done" && (
        <div className="absolute bottom-2 left-2">
          <div className="flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5">
            <Icon
              className="text-success"
              icon={CheckCircle2}
              size="xs"
            />
            <span className="text-xs font-primary text-success">{lang.uploaded}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export interface UploadDropzoneProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Single-file upload progress. Only renders with `maxFiles={1}` while that file is uploading. */
function UploadDropzoneProgress({
  className,
  ...props
}: UploadDropzoneProgressProps) {
  const { isMulti, noun, state, lang } = useUploadDropzoneContext();

  if (isMulti || state.status !== "uploading") return null;

  return (
    <div
      className={cn(
        "flex h-36 w-full flex-col items-center justify-center gap-3 rounded-xl border border-border px-6",
        className,
      )}
      {...props}
    >
      <p className="text-xs font-primary text-muted-foreground">
        {lang.uploading(noun)}...
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-300 ease-out"
          style={{
            width: `${state.progress}%`,
          }}
        />
      </div>
      <p className="text-xs font-medium font-primary text-foreground">
        {state.progress}%
      </p>
    </div>
  );
}

export interface UploadDropzoneListProps
  extends React.HTMLAttributes<HTMLUListElement> {}

/** Per-file list with progress, status and a remove button. Only renders with `maxFiles > 1` once files are picked. */
function UploadDropzoneList({ className, ...props }: UploadDropzoneListProps) {
  const { canDelete, isMulti, items, nounPlural, removeItem, lang } =
    useUploadDropzoneContext();

  if (!isMulti || items.length === 0) return null;

  return (
    <ul
      aria-label={lang.selectedLabel(nounPlural)}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {items.map((item) => {
        const kind = getFileKind({
          mimeType: item.file.type,
          name: item.file.name,
        });
        return (
          <li
            className="flex items-center gap-3 rounded-lg border border-border p-2"
            key={item.id}
          >
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
              {kind === "image" && item.url ? (
                <img
                  alt=""
                  className="size-full object-cover"
                  src={item.url}
                />
              ) : (
                <Icon
                  aria-hidden="true"
                  icon={fileKindIcon[kind]}
                  size="lg"
                />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-sm font-medium font-primary text-foreground">
                {item.file.name}
              </p>
              {item.status === "uploading" ? (
                <div className="flex items-center gap-2">
                  <div
                    aria-label={lang.uploadingItem(item.file.name)}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={item.progress}
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                  >
                    <div
                      className="h-full rounded-full bg-foreground transition-all duration-300 ease-out"
                      style={{
                        width: `${item.progress}%`,
                      }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs font-primary text-muted-foreground">
                    {item.progress}%
                  </span>
                </div>
              ) : item.status === "error" ? (
                <p className="text-xs font-primary text-destructive">
                  {item.message}
                </p>
              ) : (
                <p className="flex items-center gap-1 text-xs font-primary text-muted-foreground">
                  <Icon
                    aria-hidden="true"
                    className="text-success"
                    icon={CheckCircle2}
                    size="xs"
                  />
                  <span className="text-success">{lang.uploaded}</span>
                  <span aria-hidden="true">·</span>
                  {formatFileSize(item.file.size)}
                  {item.message ? (
                    <span className="text-destructive"> · {item.message}</span>
                  ) : null}
                </p>
              )}
            </div>
            {item.status !== "uploading" &&
              (item.status === "error" || canDelete) && (
                <Button
                  aria-label={
                    item.status === "error"
                      ? lang.dismissItem(item.file.name)
                      : lang.deleteItem(item.file.name)
                  }
                  onClick={() => void removeItem(item)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Button.Icon icon={X} />
                </Button>
              )}
          </li>
        );
      })}
    </ul>
  );
}

export interface UploadDropzoneNoticeProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

/** Shown when more files were picked/dropped than `maxFiles` allows. */
function UploadDropzoneNotice({
  className,
  ...props
}: UploadDropzoneNoticeProps) {
  const { notice } = useUploadDropzoneContext();
  if (!notice) return null;
  return (
    <p
      className={cn("text-xs text-destructive", className)}
      {...props}
    >
      {notice}
    </p>
  );
}

export interface UploadDropzoneErrorProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

/** Validation, upload or delete error — internal, or the Root's `error` prop. */
function UploadDropzoneError({
  className,
  ...props
}: UploadDropzoneErrorProps) {
  const { displayError } = useUploadDropzoneContext();
  if (!displayError) return null;
  return (
    <p
      className={cn("text-xs text-destructive", className)}
      {...props}
    >
      {displayError}
    </p>
  );
}

/**
 * Compound file dropzone. See `UploadDropzoneRoot` for the full behavior; compose it from:
 * `Root`, `Label`, `Hint`, `Trigger`, `Preview`, `Progress`, `List`, `Notice`, `Error`.
 */
export const UploadDropzone = {
  Error: UploadDropzoneError,
  Hint: UploadDropzoneHint,
  Label: UploadDropzoneLabel,
  List: UploadDropzoneList,
  Notice: UploadDropzoneNotice,
  Preview: UploadDropzonePreview,
  Progress: UploadDropzoneProgress,
  Root: UploadDropzoneRoot,
  Trigger: UploadDropzoneTrigger,
};
