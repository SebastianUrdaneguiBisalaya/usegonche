import { index, layout, prefix, type RouteConfig, route } from '@react-router/dev/routes';

export default [
	layout('../features/protected/layout.tsx', [
		index('../features/protected/today/today.tsx'),
		route('inbox', '../features/protected/inbox/inbox.tsx'),
		route('projects', '../features/protected/projects/projects.tsx'),
		route('goals', '../features/protected/goals/goals.tsx'),
		route('tasks', '../features/protected/tasks/tasks.tsx'),
		route('notes', '../features/protected/notes/notes.tsx'),
		route('reflect', '../features/protected/reflect/reflect.tsx'),
		route('reminders', '../features/protected/reminders/reminders.tsx'),
		route('tags', '../features/protected/tags/tags.tsx'),
	]),
	route('onboarding', '../features/onboarding/onboarding.tsx'),
	layout(
		'../features/auth/layout.tsx',
		prefix('auth', [
			route('sign-in', '../features/auth/sign-in.tsx'),
			route('sign-up', '../features/auth/sign-up.tsx'),
			route('verify-email', '../features/auth/verify-email.tsx'),
			route('forgot-password', '../features/auth/forgot-password.tsx'),
			route('reset-password', '../features/auth/reset-password.tsx'),
		])
	),
] satisfies RouteConfig;
