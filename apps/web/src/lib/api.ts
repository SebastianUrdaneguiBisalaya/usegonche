import { createClient, type InferRequestType } from '@usegonche/api-client';

/** Base URL of the API (`VITE_API_URL`), e.g. `http://localhost:4000`. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/** Typed Hono RPC client. Cookies carry the session, so every request includes credentials. */
export const api = createClient(API_URL, {
	init: {
		credentials: 'include',
	},
});

/** JSON body of an endpoint, inferred from the API's validators. */
export type Body<T extends (...args: never[]) => unknown> = InferRequestType<T> extends { json: infer J } ? J : never;
