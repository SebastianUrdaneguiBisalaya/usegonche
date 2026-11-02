import { ApiError } from '~/lib/api-error';

/** Rows per page of every list page. Fixed: the table fills the screen and scrolls inside the page. */
export const PAGE_SIZE = 20;

export type JsonOf<R extends { json: () => Promise<unknown> }> = Awaited<ReturnType<R['json']>>;
export type OkBody<R extends { json: () => Promise<unknown> }> = Extract<JsonOf<R>, { data: unknown }>;

/** Like `unwrap`, but keeps `meta` (pagination and counters) next to `data`. */
export async function unwrapPage<R extends { json: () => Promise<unknown>; ok: boolean; status: number }>(request: Promise<R>): Promise<OkBody<R>> {
	const res = await request;
	const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
	if (!res.ok) throw new ApiError(res.status, body.error?.code ?? 'internal_error', body.error?.message ?? '');
	return body as OkBody<R>;
}
