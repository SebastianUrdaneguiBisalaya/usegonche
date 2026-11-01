import type { Context } from 'hono';
import type { ClientErrorStatusCode, ContentfulStatusCode, ServerErrorStatusCode, SuccessStatusCode } from 'hono/utils/http-status';
import { type ErrorCode, type ErrorDetail, messageFor } from './errors.js';

/**
 * Standard API response shapes (the contract every client relies on):
 *   success: { data: T, meta?: M }
 *   error:   { error: { code, message, details?, requestId? } }
 * HTTP status carries the status; no `statusCode`/`timestamp` in the body. `code` is stable and machine-readable
 * (clients branch on it); `message` is localized for the request and safe to show to the user.
 */
type OkStatus = Extract<SuccessStatusCode, ContentfulStatusCode>;

export type ApiSuccess<T, M = undefined> = M extends undefined ? { data: T } : { data: T; meta: M };
export type ApiError = { error: { code: ErrorCode; details?: ErrorDetail[]; message: string; requestId?: string } };

/** `c.json({ data }, status)` with the status kept as a literal so RPC clients infer it. */
export const ok = <T, S extends OkStatus = 200>(c: Context, data: T, status?: S) => c.json({ data }, (status ?? 200) as S);

/** Paginated / enriched success: `{ data, meta }`. */
export const okWithMeta = <T, M extends Record<string, unknown>, S extends OkStatus = 200>(c: Context, data: T, meta: M, status?: S) => c.json({ data, meta }, (status ?? 200) as S);

/** Standard error response. The message is resolved from the i18n dictionary in the request locale. */
export const fail = <S extends ClientErrorStatusCode | ServerErrorStatusCode>(c: Context, code: ErrorCode, status: S, details?: ErrorDetail[]) =>
	c.json({ error: { code, details, message: messageFor(code), requestId: c.req.header('x-request-id') } }, status);
