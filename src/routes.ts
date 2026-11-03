import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import attachments from './features/attachments/attachments.routes.js';
import auth from './features/auth/auth.routes.js';
import goals from './features/goals/goals.routes.js';
import history from './features/history/history.routes.js';
import inbox from './features/inbox/inbox.routes.js';
import me from './features/me/me.routes.js';
import metrics from './features/metrics/metrics.routes.js';
import notes from './features/notes/notes.routes.js';
import planning from './features/planning/planning.routes.js';
import profile from './features/profile/profile.routes.js';
import projects from './features/projects/projects.routes.js';
import recurrences from './features/recurrences/recurrences.routes.js';
import reminders from './features/reminders/reminders.routes.js';
import reviews from './features/reviews/reviews.routes.js';
import search from './features/search/search.routes.js';
import suggestions from './features/suggestions/suggestions.routes.js';
import tags from './features/tags/tags.routes.js';
import tasks from './features/tasks/tasks.routes.js';

// Chain every `.route()` so `AppType` keeps the full API surface for RPC clients.
const routes = new Hono<AppEnv>()
	.route('/attachments', attachments)
	.route('/auth', auth)
	.route('/goals', goals)
	.route('/inbox', inbox)
	.route('/me', me)
	.route('/metrics', metrics)
	.route('/notes', notes)
	.route('/planning', planning)
	.route('/profile', profile)
	.route('/projects', projects)
	.route('/recurrences', recurrences)
	.route('/reminders', reminders)
	.route('/reviews', reviews)
	.route('/search', search)
	.route('/suggestions', suggestions)
	.route('/tags', tags)
	.route('/tasks', tasks)
	.route('/tasks', history);

export type AppType = typeof routes;
export default routes;
