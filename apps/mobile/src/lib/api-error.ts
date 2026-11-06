import { i18n } from '@/i18n';

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

/** A 401: the session is over (the refresh already failed). */
export const isSessionExpired = (error: unknown): boolean => error instanceof ApiError && error.status === 401;

/** `fetch` rejects (no `Response`) when the request never reached the server: offline, DNS, timeout. */
const isNetworkError = (error: unknown): boolean => error instanceof TypeError;

/** Localized text for an error: `errors.<code>` from the catalog, else the API's English message, else a generic one. */
export function getApiErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		// Every `errors.<code>` key is a string leaf; the cast gives the dynamic key a literal type for `t`.
		const text = i18n.t(`errors.${error.code}` as 'errors.generic', { defaultValue: '' });
		if (text) return text;
		if (error.message) return error.message;
	}
	if (isNetworkError(error)) return i18n.t('mobile.errors.network');
	return i18n.t('errors.generic');
}
