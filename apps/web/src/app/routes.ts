import { index, layout, prefix, type RouteConfig, route } from '@react-router/dev/routes';

export default [
	layout('../features/protected/layout.tsx', [index('../features/protected/home/home.tsx'), route('inbox', '../features/protected/inbox/inbox.tsx')]),
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
