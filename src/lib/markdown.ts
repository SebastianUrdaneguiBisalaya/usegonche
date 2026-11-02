import { z } from 'zod';

/** Max size of a Markdown document stored in a `text` column. */
export const MARKDOWN_MAX = 100_000;

/**
 * Rich text (task/project/goal descriptions, note bodies) is plain Markdown: the editor converts to and from Markdown on the
 * client. The API only bounds its size; because it is plain text it can be searched directly (full-text search).
 */
export const markdownSchema = z.string().max(MARKDOWN_MAX);
