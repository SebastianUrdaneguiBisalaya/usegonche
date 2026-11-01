import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import auth from './features/auth/auth.routes.js';
import goals from './features/goals/goals.routes.js';
import health from './features/health/health.routes.js';
import inbox from './features/inbox/inbox.routes.js';
import me from './features/me/me.routes.js';
import profile from './features/profile/profile.routes.js';
import projects from './features/projects/projects.routes.js';
import tags from './features/tags/tags.routes.js';

// Chain every `.route()` so `AppType` keeps the full API surface for RPC clients.
const routes = new Hono<AppEnv>()
	.route('/auth', auth)
	.route('/goals', goals)
	.route('/health', health)
	.route('/inbox', inbox)
	.route('/me', me)
	.route('/profile', profile)
	.route('/projects', projects)
	.route('/tags', tags);

export type AppType = typeof routes;
export default routes;
