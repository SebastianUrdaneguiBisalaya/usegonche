/** Family a file format belongs to. Drives the badge color. */
export type FileIconKind =
  | "pdf"
  | "image"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "text"
  | "other";

/** What the badge needs to know about a file: the text it shows and the family that colors it. */
export interface FileFormat {
  /** Lower-cased extension the format was resolved from, without the dot (`"jpeg"`). */
  extension: string;
  /** Short uppercase text for the badge, at most four characters (`"JPG"`). */
  label: string;
  /** Family the format belongs to. */
  kind: FileIconKind;
}

/** Longest label the badge shows; anything longer is cut so the chip stays a chip. */
export const MAX_LABEL_LENGTH = 4;

/** CSS color token behind each kind's badge, defined in `src/index.css`. */
export const KIND_COLOR: Record<FileIconKind, string> = {
  archive: "var(--file-archive)",
  audio: "var(--file-audio)",
  code: "var(--file-code)",
  document: "var(--file-document)",
  image: "var(--file-image)",
  other: "var(--file-other)",
  pdf: "var(--file-pdf)",
  presentation: "var(--file-presentation)",
  spreadsheet: "var(--file-spreadsheet)",
  text: "var(--file-text)",
  video: "var(--file-video)",
};

/** Extensions per kind. One line per family so adding a format is adding a word. */
const KIND_EXTENSIONS: Record<FileIconKind, string> = {
  archive: "zip rar 7z tar gz tgz bz2 xz zst cab",
  audio: "mp3 wav ogg oga flac aac m4a aiff opus wma mid midi",
  code: "js jsx ts tsx mjs cjs json jsonc html htm css scss sass less py rb go rs java kt swift c cpp cc h hpp cs php sh bash zsh fish ps1 sql xml yaml yml toml vue svelte astro ipynb lua dart r scala graphql gql proto",
  document: "doc docx docm dot dotx odt rtf pages epub mobi tex",
  image:
    "jpg jpeg png gif webp svg avif bmp ico tif tiff heic heif raw cr2 nef psd ai eps fig sketch xd indd",
  other:
    "exe msi dmg pkg apk ipa deb rpm iso bin img ttf otf woff woff2 eot torrent",
  pdf: "pdf",
  presentation: "ppt pptx pptm pps ppsx odp key",
  spreadsheet: "xls xlsx xlsm xlsb ods csv tsv numbers",
  text: "txt md mdx markdown log ini cfg conf env rst nfo",
  video: "mp4 m4v mov avi mkv webm wmv flv mpg mpeg 3gp ogv",
};

/** Badge text where the extension itself isn't the label people expect, or doesn't fit in four characters. */
const LABEL_OVERRIDES: Record<string, string> = {
  astro: "ASTR",
  bash: "BASH",
  graphql: "GQL",
  heif: "HEIF",
  ipynb: "NB",
  jpeg: "JPG",
  jsonc: "JSON",
  markdown: "MD",
  midi: "MIDI",
  numbers: "NUM",
  pages: "PAGE",
  scala: "SCLA",
  sketch: "SKCH",
  svelte: "SVLT",
  swift: "SWFT",
  tiff: "TIFF",
  torrent: "TRNT",
  woff2: "WOFF",
};

const EXTENSION_KIND: Record<string, FileIconKind> = {};
for (const [kind, extensions] of Object.entries(KIND_EXTENSIONS)) {
  for (const extension of extensions.split(" "))
    EXTENSION_KIND[extension] = kind as FileIconKind;
}

/** Every extension with a known kind, for docs, tests and pickers. */
export const KNOWN_EXTENSIONS: readonly string[] = Object.keys(EXTENSION_KIND);

/** MIME types that map to a format, for when all there is to go on is a `File.type` or a `data:` URL. */
const MIME_EXTENSION: Record<string, string> = {
  "application/gzip": "gz",
  "application/json": "json",
  "application/msword": "doc",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/x-7z-compressed": "7z",
  "application/x-rar-compressed": "rar",
  "application/x-tar": "tar",
  "application/xml": "xml",
  "application/zip": "zip",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "text/csv": "csv",
  "text/html": "html",
  "text/markdown": "md",
  "text/plain": "txt",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** Whole-name matches that carry no extension (`Dockerfile`, `Makefile`). */
const NAMED_FILES: Record<string, FileFormat> = {
  dockerfile: {
    extension: "dockerfile",
    kind: "code",
    label: "DOCK",
  },
  license: {
    extension: "license",
    kind: "text",
    label: "TXT",
  },
  makefile: {
    extension: "makefile",
    kind: "code",
    label: "MAKE",
  },
};

/** Compound extensions whose last segment alone would misreport the format. */
const COMPOUND_EXTENSIONS = [
  "tar.gz",
  "tar.bz2",
  "tar.xz",
  "tar.zst",
];

/**
 * Last path segment of a URL or path, without query string or fragment, percent-decoded where it can be.
 * Accepts absolute URLs, relative paths, Windows paths and bare file names alike.
 */
export function getFileName(source: string): string {
  const trimmed = source.trim();
  if (trimmed === "" || trimmed.startsWith("data:")) return "";
  const withoutQuery = trimmed.split(/[?#]/, 1)[0] ?? "";
  const segment = withoutQuery.split(/[\\/]/).pop() ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    // A stray `%` in a file name isn't an encoding error worth failing on.
    return segment;
  }
}

/**
 * Lower-cased extension of a URL, path or file name, without the dot, or `""` if there is none. Dotfiles
 * (`.gitignore`) and a trailing dot have no extension; `archive.tar.gz` reports `tar.gz`.
 */
export function getExtension(source: string): string {
  const name = getFileName(source).toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  const compound = COMPOUND_EXTENSIONS.find((suffix) =>
    name.endsWith(`.${suffix}`),
  );
  return compound ?? name.slice(dot + 1);
}

/** MIME type carried by a `data:` URL (`"data:image/png;base64,…"` → `"image/png"`), or `""`. */
function getDataUrlMime(source: string): string {
  const match = /^data:([^;,]+)/i.exec(source.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

/** Builds the badge description for one extension, known or not. Unknown extensions still get a label. */
export function describeExtension(extension: string): FileFormat | null {
  const normalized = extension.trim().replace(/^\./, "").toLowerCase();
  if (normalized === "") return null;

  const key = COMPOUND_EXTENSIONS.includes(normalized)
    ? (normalized.split(".").pop() ?? normalized)
    : normalized;
  const label = (
    LABEL_OVERRIDES[key] ?? key.toUpperCase().replace(/[^A-Z0-9]/g, "")
  ).slice(0, MAX_LABEL_LENGTH);

  return {
    extension: normalized,
    kind: EXTENSION_KIND[key] ?? "other",
    label: label === "" ? "FILE" : label,
  };
}

/**
 * Works out the format of a file from whatever there is to go on, most specific first: an explicit
 * `format`, then the extension of `source` (URL, path or name), then `mimeType` or a `data:` URL's own MIME
 * type. Returns `null` when nothing points anywhere — a name with no extension and no usable MIME type — so
 * the caller can draw a plain sheet instead of guessing.
 */
export function resolveFileFormat({
  source,
  mimeType,
  format,
}: {
  source?: string;
  mimeType?: string;
  format?: string;
}): FileFormat | null {
  if (format) return describeExtension(format);

  if (source) {
    const named = NAMED_FILES[getFileName(source).toLowerCase()];
    if (named) return named;
    const fromName = describeExtension(getExtension(source));
    if (fromName) return fromName;
  }

  const mime = (mimeType || (source ? getDataUrlMime(source) : ""))
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  const fromMime = mime ? MIME_EXTENSION[mime] : undefined;
  return fromMime ? describeExtension(fromMime) : null;
}
