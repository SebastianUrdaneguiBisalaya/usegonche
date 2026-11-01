import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import auth from './features/auth/auth.routes.js';
import health from './features/health/health.routes.js';
import me from './features/me/me.routes.js';

// Chain every `.route()` so `AppType` keeps the full API surface for RPC clients.
const routes = new Hono<AppEnv>().route('/auth', auth).route('/health', health).route('/me', me);

export type AppType = typeof routes;
export default routes;
