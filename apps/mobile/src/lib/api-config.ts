import { createClient, type InferRequestType } from '@usegonche/api-client';

/** Base URL of the API (`EXPO_PUBLIC_API_URL`, inlined at build time), e.g. `http://localhost:4000`. */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Every endpoint except `/health` lives under `/v1`. */
export const API_BASE = `${API_URL}/v1`;

/**
 * Client without the session, for the `/auth/native/*` endpoints that create or refresh it. Cookies are never sent nor stored
 * (`credentials: 'omit'`): native clients authenticate only with `Authorization: Bearer`.
 */
export const publicApi = createClient(API_BASE, { init: { credentials: 'omit' } });

/** JSON body of an endpoint, inferred from the API's validators. */
export type Body<T extends (...args: never[]) => unknown> = InferRequestType<T> extends { json: infer J } ? J : never;
