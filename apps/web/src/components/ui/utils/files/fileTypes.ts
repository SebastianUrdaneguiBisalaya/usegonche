import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
  Presentation,
} from "lucide-react";

/** Coarse family a file belongs to. Drives the icon, the label and how a preview is rendered. */
export type FileKind =
  | "image"
  | "pdf"
  | "spreadsheet"
  | "csv"
  | "document"
  | "presentation"
  | "text"
  | "code"
  | "video"
  | "audio"
  | "archive"
  | "other";

/** Icon for each `FileKind`. Monochrome by design: the glyph and the label carry the type, not a color. */
export const fileKindIcon: Record<FileKind, LucideIcon> = {
  archive: FileArchive,
  audio: FileAudio,
  code: FileCode,
  csv: FileSpreadsheet,
  document: FileText,
  image: FileImage,
  other: File,
  pdf: FileText,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
  text: FileText,
  video: FileVideo,
};

/** Human label for each `FileKind`. */
export const fileKindLabel: Record<FileKind, string> = {
  archive: "Archive",
  audio: "Audio",
  code: "Code",
  csv: "CSV",
  document: "Document",
  image: "Image",
  other: "File",
  pdf: "PDF",
  presentation: "Presentation",
  spreadsheet: "Spreadsheet",
  text: "Text",
  video: "Video",
};

const extensionKinds: Record<string, FileKind> = {
  "7z": "archive",
  aac: "audio",
  avi: "video",
  avif: "image",
  bmp: "image",
  c: "code",
  css: "code",
  csv: "csv",
  doc: "document",
  docx: "document",
  flac: "audio",
  gif: "image",
  gz: "archive",
  heic: "image",
  htm: "code",
  html: "code",
  jpeg: "image",
  jpg: "image",
  js: "code",
  json: "code",
  jsx: "code",
  log: "text",
  m4a: "audio",
  md: "text",
  mkv: "video",
  mov: "video",
  mp3: "audio",
  mp4: "video",
  odp: "presentation",
  ods: "spreadsheet",
  odt: "document",
  ogg: "audio",
  pdf: "pdf",
  png: "image",
  ppt: "presentation",
  pptx: "presentation",
  py: "code",
  rar: "archive",
  rtf: "document",
  svg: "image",
  tar: "archive",
  ts: "code",
  tsv: "csv",
  tsx: "code",
  txt: "text",
  wav: "audio",
  webm: "video",
  webp: "image",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  xml: "code",
  yaml: "code",
  yml: "code",
  zip: "archive",
};

/** Lower-cased extension of `name` without the dot (`"Report.XLSX"` → `"xlsx"`), or `""` if it has none. */
export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 || dot === name.length - 1
    ? ""
    : name.slice(dot + 1).toLowerCase();
}

/** Classifies a file from its MIME type, falling back to its extension (browsers often report `""` for xlsx, csv…). */
export function getFileKind(file: {
  name: string;
  mimeType?: string;
}): FileKind {
  const mime = (file.mimeType ?? "").toLowerCase();
  const byExtension = extensionKinds[getFileExtension(file.name)];

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/csv" || mime === "text/tab-separated-values") return "csv";
  if (mime.includes("spreadsheet") || mime === "application/vnd.ms-excel")
    return "spreadsheet";
  if (mime.includes("presentation") || mime === "application/vnd.ms-powerpoint")
    return "presentation";
  if (mime.includes("wordprocessing") || mime === "application/msword")
    return "document";
  if (mime.includes("zip") || mime.includes("compressed")) return "archive";

  return byExtension ?? (mime.startsWith("text/") ? "text" : "other");
}

/** `1536` → `"1.5 KB"`. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = [
    "KB",
    "MB",
    "GB",
    "TB",
  ];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Whether `file` satisfies an `accept` list. Entries can be an exact MIME type (`"application/pdf"`), a MIME
 * wildcard (`"image/*"`) or an extension (`".csv"`) — the same forms an `<input accept>` takes.
 */
export function matchesAccept(
  file: {
    name: string;
    type: string;
  },
  accept: readonly string[],
): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return accept.some((entry) => {
    const rule = entry.trim().toLowerCase();
    if (rule === "*/*" || rule === "*") return true;
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/** Short, readable list of what an `accept` array allows: `["image/png", ".csv"]` → `"PNG, CSV"`. */
export function describeAccept(accept: readonly string[]): string {
  const labels = accept.map((entry) => {
    const rule = entry.trim().toLowerCase();
    if (rule === "*/*" || rule === "*") return "All files";
    if (rule === "image/*") return "Images";
    if (rule === "video/*") return "Videos";
    if (rule === "audio/*") return "Audio";
    if (rule.startsWith(".")) return rule.slice(1).toUpperCase();
    const subtype = rule.split("/")[1] ?? rule;
    if (subtype.includes("spreadsheetml")) return "XLSX";
    if (subtype.includes("wordprocessingml")) return "DOCX";
    if (subtype.includes("presentationml")) return "PPTX";
    if (subtype === "vnd.ms-excel") return "XLS";
    if (subtype === "jpeg") return "JPG";
    return subtype.toUpperCase();
  });
  return Array.from(new Set(labels)).join(", ");
}
