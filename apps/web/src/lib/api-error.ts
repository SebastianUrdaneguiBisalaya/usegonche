import { getI18n, type TranslationKey } from '~/i18n';

/** A non-2xx API answer, carrying the stable `code` of the error envelope (`{ error: { code, message } }`). */
export class ApiError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

type RpcResponse = { json: () => Promise<unknown>; ok: boolean; status: number };

/** `data` of the success bodies an RPC call can answer with, inferred from the API (never redeclared). */
export type Data<R extends RpcResponse> = Extract<Awaited<ReturnType<R['json']>>, { data: unknown }>['data'];

/** Returns `data` of a successful answer and throws an `ApiError` for any other. */
export async function unwrap<R extends RpcResponse>(request: Promise<R>): Promise<Data<R>> {
	const res = await request;
	const body = (await res.json().catch(() => ({}))) as { data?: unknown; error?: { code?: string; message?: string } };
	if (!res.ok) throw new ApiError(res.status, body.error?.code ?? 'internal_error', body.error?.message ?? '');
	return body.data as Data<R>;
}

/**
 * A 401 on a protected endpoint: the session is over. A wrong email or password on sign-in is also a 401, but with `invalid_credentials`:
 * that is a form error to show, not an ended session (treating it as one reloaded sign-in and the toast never appeared).
 */
export const isSessionExpired = (error: unknown): boolean => error instanceof ApiError && error.status === 401 && error.code !== 'invalid_credentials';

export const isNotFound = (error: unknown): boolean => error instanceof ApiError && error.status === 404;

/** Localized text for an error: `errors.<code>` from the catalog, else the API's English message, else a generic one. */
export function getApiErrorMessage(error: unknown): string {
	const { t } = getI18n();
	if (error instanceof ApiError) {
		const key = `errors.${error.code}`;
		if (t(key as TranslationKey, { defaultValue: '' })) return t(key as TranslationKey);
		if (error.message) return error.message;
	}
	return t('errors.generic');
}
