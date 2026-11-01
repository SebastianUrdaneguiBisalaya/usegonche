import { hc } from 'hono/client';
import type { AppType } from '../../../src/routes.js';

// Trick from Hono's docs: the client type is computed here at build time (`pnpm --filter @usegonche/api-client build`),
// so editors read the precomputed `dist/index.d.ts` instead of re-instantiating every route type.
const client = hc<AppType>('');
export type Client = typeof client;

export const createClient = (...args: Parameters<typeof hc>): Client => hc<AppType>(...args);

export type { InferRequestType, InferResponseType } from 'hono/client';
export type { AppType };
